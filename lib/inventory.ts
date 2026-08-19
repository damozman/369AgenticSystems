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
export function describeChoices(items: InventoryItem[]): string {
  const labels = (items ?? []).map(i => i.label)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
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
    .select('item_key, label, quantity')
    .eq('client_domain', clientDomain)
    .eq('active', true)
    .order('label', { ascending: true })

  if (error) {
    console.error(`[INVENTORY] Could not read inventory for ${clientDomain}: ${error.message}`)
    return { items: [], error: error.message }
  }

  return { items: (data ?? []) as InventoryItem[], error: null }
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
