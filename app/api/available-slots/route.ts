import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { openSlots, formatSlot, formatRentalWindow, generateRentalWindows, filterAvailable, type BusyInterval, type ClientSchedule, type Slot } from '@/lib/availability'
import { getProviderForClient } from '@/lib/calendar'
import { loadSchedule } from '@/lib/client-schedule'
import { loadInventory, matchItem, isRental } from '@/lib/inventory'
import { denyIfBadRetellSecret } from '@/lib/security/route-guard'

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
  const rentalItems = inventory.filter(isRental)

  if (rentalItems.length > 0) {
    // Answer with windows when the caller named a rental item, or when everything in stock is
    // hired by the day. A mixed yard asked a vague question still gets the slot path below,
    // because "when can I come in" and "how long can I keep it" are different questions and
    // guessing which one was meant is how a caller ends up booking the wrong shape entirely.
    const namedRental = wantedItem?.kind === 'match' && isRental(wantedItem.item)
    const allRental = rentalItems.length === inventory.length

    if (namedRental || allRental) {
      const forItems = namedRental ? [wantedItem.item] : rentalItems

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
        console.log(`[SLOTS] No rental window — ${clientDomain}${outOfRange.length ? ' (length out of range)' : ''}`)
        return NextResponse.json({ slots: [], timezone: schedule.timezone, message: why })
      }

      const chosenWindows = offers.slice(0, 4)
      const spokenWindows = chosenWindows.map(o => formatRentalWindow(o.slot, schedule.timezone))

      console.log(`[SLOTS] ✓  ${chosenWindows.length} rental window(s) — ${clientDomain}`)

      return NextResponse.json({
        slots: spokenWindows,
        suggested: spokenWindows.length > 1 ? `${spokenWindows[0]} or ${spokenWindows[1]}` : spokenWindows[0],
        timezone: schedule.timezone,
        slot_details: chosenWindows.map((o, i) => ({
          spoken:    spokenWindows[i],
          starts_at: o.slot.startsAt.toISOString(),
          ends_at:   o.slot.endsAt.toISOString(),
          available_items: o.items.map(it => it.label),
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
    })),
  })
}
