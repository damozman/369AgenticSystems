/**
 * Per-item rental inventory.
 *
 * `client_schedules.max_concurrent_per_slot` answers "how many jobs at once" — right for
 * people-time, useless for things. A rental business needs to know whether *the princess castle*
 * is out on Saturday, and one scalar per client cannot say.
 *
 * The matching is pure and tested for the same reason `lib/availability.ts` is: Ava passes
 * whatever she heard, and the cost of matching the wrong unit is a child's birthday party with no
 * bounce house. Everything that decides *which* item a caller meant lives here, where a test can
 * reach it; the database read is a thin function at the bottom.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface InventoryItem {
  item_key: string
  /** What Ava says out loud. */
  label:    string
  /** How many of this item exist — two identical bounce houses genuinely take two bookings. */
  quantity: number
  /**
   * Shortest hire, in nights out. **null is the load-bearing case**: it means this item is not
   * hired by the day and is booked as an intra-day slot, exactly as every existing client's
   * items are. Only a non-null value switches the item onto multi-day rental windows.
   */
  min_rental_days: number | null
  /** Longest hire, in nights out. null alongside a set minimum means no stated maximum. */
  max_rental_days: number | null
}

/** Whether this item is hired by the day rather than booked as an intra-day appointment. */
export function isRental(item: InventoryItem): boolean {
  return item.min_rental_days !== null && item.min_rental_days >= 1
}

export type ItemMatch =
  | { kind: 'match';     item: InventoryItem }
  /** Two or more items fit equally well. Refuse rather than pick — see `matchItem`. */
  | { kind: 'ambiguous'; candidates: InventoryItem[] }
  | { kind: 'none' }

/**
 * Normalise for comparison: lowercase, strip punctuation, collapse whitespace.
 *
 * ASR renders the same unit as "Princess Castle", "princess-castle" and "the princess castle,"
 * across three calls. None of those should be three different answers.
 */
export function normalise(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip leading articles so "the bounce house" and "bounce house" agree. */
function core(value: string): string {
  return normalise(value).replace(/^(a|an|the)\s+/, '')
}

/**
 * Which item did the caller mean?
 *
 * Tiered, most exact first, and **it never guesses between equals**. If "castle" fits both the
 * Princess Castle and the Castle Combo, the honest answer is to ask which — picking the first
 * would book the wrong unit and nobody would find out until a van arrived at a party.
 *
 * Substring matching is deliberately one-directional plus its inverse, and only after exact
 * matches fail: "princess" should find "Princess Castle", and "princess castle bounce house"
 * should also find "Princess Castle", but neither should reach past a genuine exact match.
 */
export function matchItem(items: InventoryItem[], spoken: string | null | undefined): ItemMatch {
  const wanted = core(spoken ?? '')
  if (!wanted) return { kind: 'none' }

  const pool = items ?? []

  // 1. Exact on the stable key — how the tool refers to an item once it has been offered.
  const byKey = pool.filter(i => normalise(i.item_key) === wanted || core(i.item_key) === wanted)
  if (byKey.length === 1) return { kind: 'match', item: byKey[0] }
  if (byKey.length > 1)   return { kind: 'ambiguous', candidates: byKey }

  // 2. Exact on the spoken label.
  const byLabel = pool.filter(i => core(i.label) === wanted)
  if (byLabel.length === 1) return { kind: 'match', item: byLabel[0] }
  if (byLabel.length > 1)   return { kind: 'ambiguous', candidates: byLabel }

  // 3. Containment, either direction.
  const byPart = pool.filter(i => {
    const label = core(i.label)
    return label.includes(wanted) || wanted.includes(label)
  })
  if (byPart.length === 1) return { kind: 'match', item: byPart[0] }
  if (byPart.length > 1)   return { kind: 'ambiguous', candidates: byPart }

  return { kind: 'none' }
}

/** A phrase Ava can read back when she needs the caller to choose. */
/**
 * How many options are worth saying out loud.
 *
 * Four, matching the limit openSlots already uses for times — the reasoning is the same, and
 * it is about what a caller can hold in their head, not about payload size. A yard with fifty
 * chair models produced a 1,165-character instruction telling Ava to read all fifty names down
 * the phone; measured 2026-08-19.
 */
export const MAX_SPOKEN_CHOICES = 4

/**
 * A phrase Ava can read back when she needs the caller to choose.
 *
 * Truncates past MAX_SPOKEN_CHOICES rather than listing everything. The count is kept in the
 * phrase because "and 46 more" tells the caller this is a catalogue and the right move is to
 * describe what they want, whereas a bare list of four implies those are all the options.
 */
export function describeChoices(items: InventoryItem[], limit: number = MAX_SPOKEN_CHOICES): string {
  const labels = (items ?? []).map(i => i.label)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length <= limit) return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
  return `${labels.slice(0, limit).join(', ')} and ${labels.length - limit} more`
}

/**
 * Active inventory for a client.
 *
 * Returns `[]` both when the client has no inventory and when the read fails, but the two are
 * **not** the same and the caller must not treat them alike — an empty list means "this client
 * books people-time, behave exactly as before", while a failed read means "we cannot tell", which
 * has to fail closed. The error is returned rather than swallowed so the route can tell them
 * apart.
 */
export async function loadInventory(
  supabase: SupabaseClient,
  clientDomain: string,
): Promise<{ items: InventoryItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('client_inventory')
    .select('item_key, label, quantity, min_rental_days, max_rental_days')
    .eq('client_domain', clientDomain)
    .eq('active', true)
    .order('label', { ascending: true })

  if (error) {
    console.error(`[INVENTORY] Could not read inventory for ${clientDomain}: ${error.message}`)
    return { items: [], error: error.message }
  }

  // Normalised rather than cast: a row written before the rental-windows migration comes back
  // with these keys absent, and `undefined` would slip past the `!== null` check in isRental()
  // and switch a chair onto multi-day hire.
  const items: InventoryItem[] = (data ?? []).map(r => ({
    item_key: r.item_key,
    label:    r.label,
    quantity: r.quantity,
    min_rental_days: r.min_rental_days ?? null,
    max_rental_days: r.max_rental_days ?? null,
  }))

  return { items, error: null }
}

/**
 * The stable database key for an item, derived from what the client typed.
 *
 * Shared deliberately. The onboarding questionnaire and the spreadsheet importer both create
 * inventory, and if they derived keys differently the same "Princess Castle" would land twice
 * under two keys — one of which no booking would ever reference again.
 *
 * `item_key` is the column `bookings.inventory_item_key` points at, so it must never change
 * for an item that has been booked. That is precisely why clients are not asked to invent it:
 * a label is a name and can be reworded freely, a key is an identity and cannot.
 */
export function deriveItemKey(label: string): string {
  return (label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}
