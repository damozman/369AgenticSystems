/**
 * Seeds a client's rental inventory, and tells you what Ava will MISHEAR before a caller does.
 *
 * The interesting half is not the insert. `lib/inventory.ts:matchItem` deliberately **refuses
 * rather than guesses**: if a caller says "castle" and the yard stocks both a Princess Castle
 * and a Castle Combo, it returns `ambiguous` and Ava has to ask which one. That is correct —
 * picking one sends the wrong van to a child's birthday party — but it is a worse conversation
 * than necessary, and it is entirely avoidable by choosing labels that do not collide.
 *
 * So this runs the REAL matcher over the REAL list before writing, and reports every phrase
 * that would come back ambiguous. Renaming a label now costs nothing; discovering it on a
 * live call costs a booking.
 *
 * DRY RUN BY DEFAULT.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-inventory.mjs <domain>
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/setup-client-inventory.mjs <domain> --apply
 */

import { createClient } from '@supabase/supabase-js'
import { matchItem, describeChoices } from '../lib/inventory.ts'

// ---------------------------------------------------------------------------------------
// REPLACE THIS with the client's real stock before running with --apply.
//
// item_key  stable, lowercase, never spoken aloud — what bookings.inventory_item_key stores.
//           Renaming it orphans existing bookings, so pick it once.
// label     what Ava actually says. Safe to reword later.
// quantity  how many identical units exist. Two identical bounce houses = quantity 2, ONE row.
//           This does not track WHICH physical unit goes out; nothing does yet.
// ---------------------------------------------------------------------------------------
const ITEMS = [
  { item_key: 'princess_castle', label: 'Princess Castle bounce house', quantity: 1 },
  { item_key: 'castle_combo',    label: 'Castle Combo bounce house',    quantity: 1 },
  { item_key: 'blackjack_table', label: 'Blackjack table',              quantity: 2 },
  { item_key: 'roulette_table',  label: 'Roulette table',               quantity: 1 },
  { item_key: 'dj_package',      label: 'DJ package',                   quantity: 1 },
]

const domain = process.argv[2]
const APPLY  = process.argv.includes('--apply')
if (!domain || domain.startsWith('--')) {
  console.error('Usage: ... scripts/setup-client-inventory.mjs <client_domain> [--apply]')
  process.exit(1)
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failures = 0, warnings = 0
const ok   = (m) => console.log(`  [ok]   ${m}`)
const bad  = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const warn = (m) => { warnings++; console.log(`  [warn] ${m}`) }
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

// --- 1. Client must exist (FK) -----------------------------------------------------------
heading('1. Client')
const { data: sub } = await supabase.from('agent_subscriptions').select('client_domain, business_name').eq('client_domain', domain).maybeSingle()
if (!sub) {
  bad(`no agent_subscriptions row for ${domain} — client_inventory.client_domain is a FK to it`)
  process.exit(1)
}
ok(`${sub.business_name}`)

// --- 2. Shape ------------------------------------------------------------------------------
heading('2. Item shape')
const keys = new Set()
for (const it of ITEMS) {
  if (it.item_key !== it.item_key.toLowerCase() || !it.item_key) bad(`item_key must be lowercase and non-empty: "${it.item_key}" (DB check constraint)`)
  if (keys.has(it.item_key)) bad(`duplicate item_key "${it.item_key}" — the unique index will reject it`)
  keys.add(it.item_key)
  if (!Number.isInteger(it.quantity) || it.quantity < 1) bad(`quantity must be an integer >= 1: ${it.item_key} has ${it.quantity}`)
  if (!it.label?.trim()) bad(`label is required: ${it.item_key}`)
}
if (!failures) ok(`${ITEMS.length} item(s), keys unique and well-formed`)

// --- 3. What Ava will mishear --------------------------------------------------------------
heading('3. Spoken matching (the REAL matchItem)')
const pool = ITEMS.map(i => ({ item_key: i.item_key, label: i.label, quantity: i.quantity, active: true }))

// Every full label must resolve to itself. If it does not, a caller who says the item's own
// name verbatim still gets asked to clarify.
for (const it of pool) {
  const m = matchItem(pool, it.label)
  if (m.kind === 'match' && m.item.item_key === it.item_key) ok(`"${it.label}" -> ${it.item_key}`)
  else if (m.kind === 'ambiguous') bad(`"${it.label}" is AMBIGUOUS against: ${describeChoices(m.candidates)}`)
  else bad(`"${it.label}" does not resolve to itself (${m.kind})`)
}

// Now the partial phrases a caller actually uses — single significant words from each label.
const stop = new Set(['the','a','and','package','table','house','bounce'])
const phrases = new Set()
for (const it of pool) for (const w of it.label.toLowerCase().split(/[^a-z0-9]+/)) {
  if (w && w.length > 2 && !stop.has(w)) phrases.add(w)
}
console.log('\n  Partial phrases a caller might say:')
for (const p of [...phrases].sort()) {
  const m = matchItem(pool, p)
  if (m.kind === 'match')          console.log(`     "${p}" -> ${m.item.item_key}`)
  else if (m.kind === 'ambiguous') warn(`"${p}" is ambiguous -> Ava must ask: "${describeChoices(m.candidates)}" (consider distinct labels)`)
  else                             console.log(`     "${p}" -> no match, Ava lists everything`)
}

// --- 4. Write --------------------------------------------------------------------------------
heading('4. Write')
if (failures) { console.log(`  BLOCKED — ${failures} failure(s).`); process.exit(1) }
if (!APPLY) {
  console.log(`  DRY RUN — nothing written. ${warnings} warning(s).`)
  console.log('  Re-run with --apply once ITEMS reflects the client\'s real stock.')
  process.exit(0)
}

const { error } = await supabase
  .from('client_inventory')
  .upsert(ITEMS.map(i => ({ client_domain: domain, ...i, active: true })), { onConflict: 'client_domain,item_key' })
if (error) { bad(`write failed: ${error.message}`); process.exit(1) }

// Re-read: a write is not a change until the reader returns it.
const { items, error: loadErr } = await import('../lib/inventory.ts').then(m => m.loadInventory(supabase, domain))
if (loadErr) bad(`loadInventory failed after write: ${loadErr}`)
else if (items.length !== ITEMS.length) bad(`wrote ${ITEMS.length} but loader returns ${items.length}`)
else ok(`loader returns all ${items.length} item(s): ${items.map(i => i.label).join(', ')}`)

heading('Verdict')
console.log(failures ? `  ${failures} FAILURE(S)` : `  Inventory applied. ${warnings} ambiguity warning(s).`)
process.exit(failures ? 1 : 0)
