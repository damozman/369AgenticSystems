import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { openSlots, formatSlot, formatRentalWindow, generateRentalWindows, filterAvailable, type BusyInterval, type ClientSchedule, type Slot } from '@/lib/availability'
import { getProviderForClient } from '@/lib/calendar'
import { loadSchedule } from '@/lib/client-schedule'
import { loadInventory, matchItem, isRental, describeChoices, MAX_SPOKEN_CHOICES } from '@/lib/inventory'
import { denyIfBadRetellSecret } from '@/lib/security/route-guard'
import { mintBookingToken } from '@/lib/security/booking-token'

/**
 * The times Ava offers a caller.
 *
 * This route used to be a GET taking no arguments that returned hardcoded 10:00 AM and 2:00 PM
 * slots, Mon–Fri, always America/Chicago. It read no calendar and — more damaging — never read
 * the bookings table, so Ava could hand the same Tuesday 10:00 AM to five different callers and
 * nothing anywhere objected.
 *
 * It is now a POST because it needs to know *which* client is asking. Retell's custom-tool
 * envelope carries the call id, and the call resolves to a client exactly as book-appointment
 * already does.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
  // Now guarded. The old route was public because it returned nothing but invented dates;
  // this one reads a specific client's working hours and their booked appointments.
  const denied = denyIfBadRetellSecret(request)
  if (denied) return denied

  let raw: Record<string, unknown> = {}
  try {
    raw = await request.json()
  } catch {
    // Retell has been observed calling argument-less tools with an empty body. That is not an
    // error — it just means no call context, which the demo-line fallback below handles.
  }

  const retellCall = raw.call as { call_id?: string } | undefined
  const source = (raw.args ?? raw) as Record<string, unknown>
  const callId = retellCall?.call_id ?? (source.call_id as string | undefined)

  // Optional: the caller already named a unit ("do you have the princess castle Saturday?"), so
  // only that unit's availability matters. Absent, we report what is free across everything.
  const requestedItem = (source.item as string | undefined) ?? null

  // Resolve the caller's client. Same convention as book-appointment: fall back to the demo
  // line rather than failing, so a demo call still gets real slots.
  let clientDomain = (source.client_domain as string | undefined) ?? null
  if (!clientDomain && callId) {
    const { data: callRow } = await supabase
      .from('calls')
      .select('client_domain')
      .eq('call_id', callId)
      .maybeSingle()
    clientDomain = callRow?.client_domain ?? null
  }
  clientDomain ??= 'demo.369agenticsystems.com'

  const schedule = await loadSchedule(supabase, clientDomain)

  // Only the window Ava can actually offer from. Cancelled appointments free their slot.
  const horizonEnd = new Date(Date.now() + (schedule.booking_horizon_days + 1) * 86_400_000)
  const { data: busy, error: busyError } = await supabase
    .from('bookings')
    .select('starts_at, ends_at, inventory_item_key')
    .eq('client_domain', clientDomain)
    .neq('status', 'cancelled')
    .not('starts_at', 'is', null)
    .lte('starts_at', horizonEnd.toISOString())

  // Refusing to answer is better than offering a slot that is already taken: an unreadable
  // bookings table is exactly the case where Ava would double-book.
  if (busyError) {
    console.error('[SLOTS] Could not read existing bookings:', busyError.message)
    return NextResponse.json(
      { error: `Could not check the calendar: ${busyError.message}` },
      { status: 503 },
    )
  }

  // The owner's own calendar, when they have connected one. Without this the bookings table is
  // the only thing consulted, so Ava will happily offer 10:00 AM while the owner sits in a
  // dentist's chair — not a double booking in this database, and completely wrong in the world.
  //
  // `null` means no calendar connected, which is where every client starts and behaves exactly
  // as this route did before.
  const externalBusy: BusyInterval[] = []
  const provider = await getProviderForClient(supabase, clientDomain)
  if (provider) {
    try {
      externalBusy.push(...await provider.busy({ from: new Date(), to: horizonEnd }))
    } catch (e) {
      // Fail closed, for the same reason the unreadable-bookings branch above does: an
      // unanswerable calendar is precisely the case where Ava would double-book. Taking a
      // message is the honest answer, and the reconciler cron is what tells the owner their
      // connection needs attention.
      console.error(`[SLOTS] Calendar unreachable for ${clientDomain}:`, (e as Error).message)
      return NextResponse.json(
        {
          error:   'calendar_unavailable',
          message: 'The calendar could not be checked. Apologise, take the caller\'s name and number, and tell them someone will call straight back to confirm a time.',
        },
        { status: 503 },
      )
    }
  }

  /**
   * Rental inventory, for clients that stock things rather than sell time.
   *
   * An empty list is the normal case and must behave exactly as this route did before — every
   * existing client books people-time. A failed *read* is a different thing entirely and fails
   * closed, for the same reason the calendar branch above does.
   */
  const { items: inventory, error: inventoryError } = await loadInventory(supabase, clientDomain)
  if (inventoryError) {
    return NextResponse.json(
      {
        error:   'inventory_unavailable',
        message: 'The equipment list could not be checked. Apologise, take the caller\'s name and number, and tell them someone will call straight back to confirm a time.',
      },
      { status: 503 },
    )
  }

  const allBusy = (busy ?? []) as (BusyInterval & { inventory_item_key?: string | null })[]

  // ── People-time clients: unchanged. ─────────────────────────────────────────
  if (inventory.length === 0) {
    const slots = openSlots(schedule, [...allBusy, ...externalBusy], { limit: 4, perDay: 2 })
    return respond(slots, schedule, clientDomain)
  }

  // ── Rental clients: which slots, and which units in them. ───────────────────
  //
  // Bookings that name no item consume general capacity (a site visit, a consultation), so they
  // still gate the slot for everyone. Bookings that name an item only gate that item.
  const generalBusy = allBusy.filter(b => !b.inventory_item_key)

  /**
   * Items hired BY THE DAY are answered with multi-day windows, not intra-day slots.
   *
   * Offering a dumpster a 60-minute slot is not a smaller version of the right answer, it is the
   * wrong answer: the unit is in someone's driveway until they are done with it. So rental items
   * are handled here and deliberately excluded from the slot pass below — safe to do because
   * `min_rental_days` is new and null on every existing row, so nothing in production changes
   * shape until someone sets it.
   */
  const wantedItem = requestedItem ? matchItem(inventory, requestedItem) : null

  /**
   * A named item that resolves to more than one thing is answered here, not left to fall through.
   *
   * Until 2026-08-20 an ambiguous name dropped into the slot pass below, which answers with
   * intra-day appointment times. Observed on a real call: "do you have a bounce house?" — four
   * of them in stock — came back "8:00 AM or 9:00 AM". That is not a vaguer answer, it is the
   * wrong SHAPE of answer, and Ava read it out. Refusing costs one clarifying question; guessing
   * sends the wrong van to a child's party, which is the whole reason matchItem refuses at all.
   */
  const ambiguousCandidates = wantedItem?.kind === 'ambiguous' ? wantedItem.candidates : null

  /**
   * Narrowing by AVAILABILITY beats asking the caller to narrow by name.
   *
   * The refusal above is still right — "castle" matches Princess Castle and Castle Combo, and
   * picking one sends the wrong van to a child's party. But asking "which of these three?" before
   * checking any of them is what produced this, on a real call 2026-08-21:
   *
   *     "We've got Castle Combo, Princess Castle, or Sports Arena. Which one do you want?"
   *     "...and those are available Saturday, right?"
   *     "I need to check each specific one to confirm."
   *
   * The caller has to choose blind, and is then told no. Offering only the candidates that are
   * genuinely free is not choosing FOR them — they still pick — so the safety property holds
   * while the question becomes answerable. Hire candidates therefore fall through to the rental
   * pass below, which already checks each one and names it.
   */
  const ambiguousRentals = ambiguousCandidates?.filter(isRental) ?? []

  if (ambiguousCandidates && ambiguousRentals.length === 0) {
    const tooManyToRead = ambiguousCandidates.length > MAX_SPOKEN_CHOICES
    console.log(`[SLOTS] ⚠  "${requestedItem}" is ambiguous across ${ambiguousCandidates.length} item(s) — ${clientDomain}`)
    return NextResponse.json({
      slots: [],
      timezone: schedule.timezone,
      error: 'item_ambiguous',
      // Same two shapes book-appointment uses, for the same reason: reading fifty chair styles
      // down the phone is a catalogue nobody can listen to.
      message: tooManyToRead
        ? `There are ${ambiguousCandidates.length} items matching that. Do NOT read the list out. `
          + 'Ask whether they have an item or model number, or have them describe what they are '
          + `after — a few examples are ${describeChoices(ambiguousCandidates, 3)}.`
        : `Ask which one they mean: ${describeChoices(ambiguousCandidates)}.`,
      options: ambiguousCandidates.map(c => c.label),
    })
  }

  if (ambiguousRentals.length > 0) {
    console.log(`[SLOTS] ⚠  "${requestedItem}" matches ${ambiguousRentals.length} hire item(s) — offering the free ones — ${clientDomain}`)
  }

  const rentalItems = inventory.filter(isRental)

  /**
   * An unknown item used to return the WHOLE catalogue as `options`, with nothing checked against
   * the calendar. Ava read that list out as if it were an offer, the caller picked one, and only
   * then did she discover every one of them was busy — observed on a real call 2026-08-21, where
   * "Unicorn" produced four suggestions and all four came back unavailable a turn later.
   *
   * Reciting stock is not answering "what can I have on Saturday". So when the yard hires things
   * out, fall through to the rental pass below instead of returning early: it already computes
   * real availability across every rental item and reports which item each window belongs to.
   * The caller then hears only things they can actually book.
   *
   * A business with no rental items has no such pass to fall into, so it keeps the old reply —
   * but even then the list is capped, because reading a long catalogue down the phone is its own
   * failure. `describeChoices` already refuses past MAX_SPOKEN_CHOICES.
   */
  const notStocked = wantedItem?.kind === 'none' ? (requestedItem ?? 'that') : null

  if (notStocked && rentalItems.length === 0) {
    console.log(`[SLOTS] ⚠  "${requestedItem}" is not stocked — ${clientDomain}`)
    return NextResponse.json({
      slots: [],
      timezone: schedule.timezone,
      error: 'item_unknown',
      message: `That is not something this business stocks. What they do have is ${describeChoices(inventory)}. `
        + 'Do not present any of these as available until you have checked one.',
      options: inventory.map(c => c.label),
    })
  }

  if (notStocked) {
    console.log(`[SLOTS] ⚠  "${requestedItem}" is not stocked — offering what is actually free — ${clientDomain}`)
  }

  if (rentalItems.length > 0) {
    const namedRental = wantedItem?.kind === 'match' && isRental(wantedItem.item)
    const allRental = rentalItems.length === inventory.length

    /**
     * `notStocked` — the caller named a hire item this yard does not carry.
     * `vague` — they named nothing at all ("what have you got for Saturday?").
     *
     * Both used to fall through to intra-day appointment slots on a MIXED yard, on the reasoning
     * that "when can I come in" and "how long can I keep it" are different questions and guessing
     * between them books the wrong shape. Reversed 2026-08-21 at Chris's direction, after a real
     * call: for a yard that hires anything out, the overwhelmingly common vague question is about
     * UNITS, and answering it with appointment times sends the caller away from the thing they
     * actually wanted. Answer with units.
     *
     * Known limit: this pass only considers items with `min_rental_days` set, so a mixed yard's
     * non-hire stock (tables, chairs) is invisible to a vague question. That is the right trade
     * while hire items are the scarce, identity-shaped ones — but it is why the pilot's inventory
     * should mark everything she hires out as a rental item.
     */
    const vague = !requestedItem

    if (namedRental || allRental || notStocked || vague || ambiguousRentals.length > 0) {
      // An ambiguous name narrows to ITS candidates, not the whole yard — "bounce house" should
      // answer with bounce houses, never with a tent that happens to be free.
      const forItems = namedRental
        ? [wantedItem.item]
        : ambiguousRentals.length > 0 ? ambiguousRentals : rentalItems

      // How long they want it. Absent is the common case on a first question — fall back to the
      // item's own minimum, which is the shortest honest answer rather than a guess.
      const askedDays = Number(source.rental_days)
      const requestedDays = Number.isFinite(askedDays) && askedDays >= 1 ? Math.floor(askedDays) : null

      const offers: { slot: Slot; items: typeof forItems }[] = []
      // Items skipped only because the requested length is outside their range. "We have none
      // free" and "you asked for a hire we do not do" are completely different answers, and
      // giving the first when the second is true sends a caller away from an idle unit.
      const outOfRange: string[] = []

      for (const it of forItems) {
        const days = requestedDays ?? it.min_rental_days ?? 1

        // Refuse rather than silently shortening or extending: a hire outside the stated range
        // is a different price, and quietly changing it is how someone is billed for a day they
        // did not agree to.
        if (it.min_rental_days !== null && days < it.min_rental_days) {
          outOfRange.push(`the ${it.label} goes out for at least ${it.min_rental_days} days`)
          continue
        }
        if (it.max_rental_days !== null && days > it.max_rental_days) {
          outOfRange.push(`the ${it.label} goes out for at most ${it.max_rental_days} days`)
          continue
        }

        const windows = generateRentalWindows(schedule, days)
        const itemBusy = allBusy.filter(b => b.inventory_item_key === it.item_key)
        const free = filterAvailable(
          windows,
          [...itemBusy, ...generalBusy, ...externalBusy],
          it.quantity,
          schedule.slot_duration_minutes,
        )
        for (const w of free) offers.push({ slot: w, items: [it] })
      }

      offers.sort((a, b) => a.slot.startsAt.getTime() - b.slot.startsAt.getTime())

      if (offers.length === 0) {
        // Say WHICH of the two it is. Telling a caller nothing is free, when in truth they asked
        // for a two-day hire on a unit with a three-day minimum, loses a booking we could take.
        const why = outOfRange.length > 0
          ? `That length is not one they hire out — ${outOfRange.join(', and ')}. Tell them the minimum and ask if that works.`
          : 'Nothing is free for those dates. Offer to take their details and have someone call back.'
        const prefix = notStocked
          ? `They do not stock "${notStocked}". `
          : ambiguousRentals.length > 0
            ? `Nothing matching "${requestedItem}" is free — say so plainly rather than listing the ones that are not. `
            : ''
        console.log(`[SLOTS] No rental window — ${clientDomain}${outOfRange.length ? ' (length out of range)' : ''}`)
        return NextResponse.json({ slots: [], timezone: schedule.timezone, message: prefix + why })
      }

      // Offers are sorted by time, so the earliest four can all be the SAME unit — which answers
      // "when is the Castle Combo free" when the caller asked "what do you have on Saturday".
      // When several items are in play, take each item's earliest window first, then backfill.
      // One item still gets its next-best times, because there is nothing else to show.
      const chosenWindows = (() => {
        if (forItems.length <= 1) return offers.slice(0, 4)
        const seen = new Set<string>()
        const spread = offers.filter(o => {
          const key = o.items[0]?.item_key ?? ''
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        return [...spread, ...offers.filter(o => !spread.includes(o))].slice(0, 4)
      })()
      // When the caller named one item, the window alone is the answer — they know what it is for.
      // When several items are in play (a vague question, or one we do not stock) a bare "Saturday
      // at 10" does not say *of what*, so Ava either guesses or re-checks item by item — which is
      // what produced seven check_availability calls on one real call. Name the item inline.
      const spokenWindows = chosenWindows.map(o => {
        const window = formatRentalWindow(o.slot, schedule.timezone)
        const label = o.items[0]?.label
        return forItems.length > 1 && label ? `${label} — ${window}` : window
      })

      console.log(`[SLOTS] ✓  ${chosenWindows.length} rental window(s) — ${clientDomain}`)

      return NextResponse.json({
        slots: spokenWindows,
        suggested: spokenWindows.length > 1 ? `${spokenWindows[0]} or ${spokenWindows[1]}` : spokenWindows[0],
        timezone: schedule.timezone,
        // Every window below IS free, so Ava can answer in one breath instead of naming options
        // she has not checked and then walking them back.
        ...(notStocked
          ? {
              error: 'item_unknown',
              message: `They do not stock "${notStocked}". Say so, then offer ONLY from the windows below — `
                + 'each one names the item that is actually free. Do not read out the rest of the catalogue.',
            }
          : ambiguousRentals.length > 0
            ? {
                message: `"${requestedItem}" matches more than one item. Every window below is genuinely free — `
                  + 'offer these by name and let them choose. Do NOT ask which one they meant first, and do '
                  + 'not name a match that is not listed here.',
              }
            : {}),
        // booking_token carries the item and the exact hire interval, so book_appointment does
        // not depend on Ava re-supplying them. See lib/security/booking-token.ts.
        slot_details: chosenWindows.map((o, i) => ({
          spoken:    spokenWindows[i],
          starts_at: o.slot.startsAt.toISOString(),
          ends_at:   o.slot.endsAt.toISOString(),
          available_items: o.items.map(it => it.label),
          booking_token: mintBookingToken({
            itemKey:  o.items[0]?.item_key ?? null,
            startsAt: o.slot.startsAt,
            endsAt:   o.slot.endsAt,
          }),
        })),
        inventory: forItems.map(it => it.label),
      })
    }
  }

  // A wider net than the four we will offer: a slot rejected for one unit may be fine for
  // another, so there has to be something left to choose from after the per-item pass.
  const candidates = openSlots(schedule, [...generalBusy, ...externalBusy], { limit: 12, perDay: 6 })

  // One pass per item, reusing filterAvailable exactly as intended — that item's busy intervals
  // and that item's quantity. No new overlap arithmetic; the tested version already handles the
  // half-open boundary and the missing-end-time case.
  const freeByItem = new Map<string, Set<number>>()
  for (const it of inventory) {
    const itemBusy = allBusy.filter(b => b.inventory_item_key === it.item_key)
    const free = filterAvailable(candidates, itemBusy, it.quantity, schedule.slot_duration_minutes)
    freeByItem.set(it.item_key, new Set(free.map(s => s.startsAt.getTime())))
  }

  // If the caller already named a unit, only that unit's availability is interesting.
  const wanted = requestedItem ? matchItem(inventory, requestedItem) : null
  const considered = wanted?.kind === 'match' ? [wanted.item] : inventory.filter(it => !isRental(it))

  const withItems = candidates
    .map(slot => ({
      slot,
      items: considered.filter(it => freeByItem.get(it.item_key)?.has(slot.startsAt.getTime())),
    }))
    .filter(entry => entry.items.length > 0)

  // Spread the same way openSlots does — two options on each of two days beats four in one
  // morning — then trim to what a caller can actually hold in their head.
  const chosen = withItems.slice(0, 4)

  if (chosen.length === 0) {
    console.log(`[SLOTS] No unit available in the next ${schedule.booking_horizon_days} days — ${clientDomain}`)
    return NextResponse.json({
      slots: [],
      suggested: null,
      timezone: schedule.timezone,
      message: wanted?.kind === 'match'
        ? `Nothing free for the ${wanted.item.label} in the scheduling window. Offer another item, or take a message.`
        : 'No equipment is free in the scheduling window. Offer to take a message and have someone call back.',
    })
  }

  const spokenItems = chosen.map(c => c.slot).map(s => formatSlot(s, schedule.timezone))

  console.log(`[SLOTS] ✓  ${chosen.length} open across ${inventory.length} item(s) — ${clientDomain}`)

  return NextResponse.json({
    slots: spokenItems,
    suggested: spokenItems.length > 1 ? `${spokenItems[0]} or ${spokenItems[1]}` : spokenItems[0],
    timezone: schedule.timezone,
    // What is actually free, so Ava offers from the tool's answer rather than from a list in her
    // prompt that goes stale the day a unit is sold.
    slot_details: chosen.map((c, i) => ({
      spoken:    spokenItems[i],
      starts_at: c.slot.startsAt.toISOString(),
      ends_at:   c.slot.endsAt.toISOString(),
      available_items: c.items.map(it => it.label),
      // Only when the caller's request narrowed to ONE unit. With several still in play there is
      // no single item to commit to, and a token naming an arbitrary one would book a guess.
      booking_token: mintBookingToken({
        itemKey:  c.items.length === 1 ? c.items[0].item_key : null,
        startsAt: c.slot.startsAt,
        endsAt:   c.slot.endsAt,
      }),
    })),
    inventory: inventory.map(it => it.label),
  })
}

/** The people-time response, unchanged from before inventory existed. */
function respond(slots: Slot[], schedule: ClientSchedule, clientDomain: string) {

  // Genuinely full. Saying so is the honest answer — the old route could never produce it.
  if (slots.length === 0) {
    console.log(`[SLOTS] No availability in the next ${schedule.booking_horizon_days} days — ${clientDomain}`)
    return NextResponse.json({
      slots: [],
      suggested: null,
      timezone: schedule.timezone,
      message: 'No open appointments in the scheduling window. Offer to take a message and have someone call back.',
    })
  }

  const spoken = slots.map(s => formatSlot(s, schedule.timezone))

  console.log(`[SLOTS] ✓  ${slots.length} open — ${clientDomain}`)

  return NextResponse.json({
    slots: spoken,
    // Two options, not four — a caller asked to choose between four times picks none.
    suggested: spoken.length > 1 ? `${spoken[0]} or ${spoken[1]}` : spoken[0],
    timezone: schedule.timezone,
    // The exact instants behind the spoken strings. book_appointment prefers starts_at over
    // re-parsing prose, which is how an appointment ends up an hour or a year off.
    slot_details: slots.map((s, i) => ({
      spoken:     spoken[i],
      starts_at:  s.startsAt.toISOString(),
      ends_at:    s.endsAt.toISOString(),
      // A people-time slot: no item, so the token carries only the interval. Every existing
      // client is in this branch, and it behaves exactly as before if the token is ignored.
      booking_token: mintBookingToken({ itemKey: null, startsAt: s.startsAt, endsAt: s.endsAt }),
    })),
  })
}
