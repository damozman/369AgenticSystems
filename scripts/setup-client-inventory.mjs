/**
 * Seeds a client's rental inventory from the spreadsheet they filled in, and tells you what
 * Ava will MISHEAR before a caller does.
 *
 * Reads CSV *or* XLSX through lib/ops-brief-parse.ts:parseRawRows — the same parser the
 * wholesale ops-brief upload uses. It already handles the things real business spreadsheets
 * do: title rows above the header, blank spacer rows, numbers stored as text. There was no
 * reason to write a second one.
 *
 * The client supplies LABELS AND COUNTS ONLY. `item_key` is derived here, because it is a
 * database key that must never change once a booking references it — not something to ask a
 * bounce-house owner to invent.
 *
 * The interesting half is not the insert. lib/inventory.ts:matchItem deliberately **refuses
 * rather than guesses**: if a caller says "castle" and the yard stocks a Princess Castle and a
 * Castle Combo, it returns `ambiguous` and Ava asks which one, because picking one sends the
 * wrong van to a child's birthday party. Correct, but a worse conversation than necessary and
 * entirely avoidable by choosing labels that do not collide — so every collision is reported
 * here, while renaming is still free.
 *
 * DRY RUN BY DEFAULT.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs \
 *     scripts/setup-client-inventory.mjs <domain> <path-to-file.xlsx|.csv>
 *   ... --apply
 *
 * Template for the client: templates/client-inventory-template.csv
 */

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseRawRows } from '../lib/ops-brief-parse.ts'
import { matchItem, describeChoices, loadInventory, deriveItemKey } from '../lib/inventory.ts'

const domain   = process.argv[2]
const filePath = process.argv[3]
const APPLY    = process.argv.includes('--apply')

if (!domain || !filePath || domain.startsWith('--') || filePath.startsWith('--')) {
  console.error('Usage: ... scripts/setup-client-inventory.mjs <client_domain> <file.xlsx|file.csv> [--apply]')
  process.exit(1)
}

// Header aliases. The template we hand out uses the first of each, but people rename columns,
// and a spreadsheet that came from their own stock list will not match ours.
const COLUMNS = {
  label:    ['item_name', 'item name', 'item', 'name', 'description', 'equipment', 'product'],
  quantity: ['how_many_you_own', 'how many you own', 'quantity', 'qty', 'count', 'units', 'how many'],
  active:   ['available', 'active', 'in service', 'in_service'],
}

let failures = 0, warnings = 0
const ok   = (m) => console.log(`  [ok]   ${m}`)
const bad  = (m) => { failures++; console.log(`  [FAIL] ${m}`) }
const warn = (m) => { warnings++; console.log(`  [warn] ${m}`) }
const heading = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)


const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// --- 1. Client must exist (FK) -----------------------------------------------------------
heading('1. Client')
const { data: sub } = await supabase
  .from('agent_subscriptions').select('client_domain, business_name').eq('client_domain', domain).maybeSingle()
if (!sub) {
  bad(`no agent_subscriptions row for ${domain} — client_inventory.client_domain is a FK to it`)
  process.exit(1)
}
ok(sub.business_name)

// --- 2. Parse ------------------------------------------------------------------------------
heading('2. File')
if (!fs.existsSync(filePath)) { bad(`no such file: ${filePath}`); process.exit(1) }
let buf = fs.readFileSync(filePath)

// A BOM-less UTF-8 CSV is read as latin1 by the xlsx parser, which turns an em dash into
// "â" and an apostrophe or accent into mojibake. That matters here because these strings
// are LABELS — the words Ava reads aloud — so a mangled one is a mispronounced item name on
// a live call. Prepending the BOM makes the parser decode as UTF-8. .xlsx carries its own
// encoding and needs none of this.
if (/\.csv$/i.test(filePath)) {
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF])
  if (!buf.subarray(0, 3).equals(BOM)) buf = Buffer.concat([BOM, buf])
}

const rows = parseRawRows(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
ok(`${rows.length} non-empty row(s) read from ${filePath}`)

// Find the header row rather than assuming row 0 — the parser keeps title rows, and a client's
// own stock list often has the business name across the top.
let headerIndex = -1, colIdx = {}
for (let i = 0; i < Math.min(rows.length, 10); i++) {
  const cells = rows[i].map(c => c.toLowerCase().trim())
  const found = {}
  for (const [field, aliases] of Object.entries(COLUMNS)) {
    const idx = cells.findIndex(c => aliases.includes(c))
    if (idx !== -1) found[field] = idx
  }
  if (found.label !== undefined && found.quantity !== undefined) { headerIndex = i; colIdx = found; break }
}
if (headerIndex === -1) {
  bad('could not find a header row containing an item-name column and a quantity column')
  console.log(`  Looked for: ${COLUMNS.label.slice(0, 4).join(' / ')} and ${COLUMNS.quantity.slice(0, 4).join(' / ')}`)
  console.log(`  First rows seen: ${JSON.stringify(rows.slice(0, 3))}`)
  process.exit(1)
}
ok(`header on row ${headerIndex}: label=col${colIdx.label}, quantity=col${colIdx.quantity}` +
   (colIdx.active !== undefined ? `, available=col${colIdx.active}` : ', (no availability column — all treated as available)'))

// --- 3. Rows -> items ------------------------------------------------------------------------
heading('3. Items')
const ITEMS = []
const seenKeys = new Map()
for (let i = headerIndex + 1; i < rows.length; i++) {
  const row = rows[i]
  const label = (row[colIdx.label] ?? '').trim()
  if (!label) continue
  // The template ships with example rows; skip them so a client who edits around them is safe.
  if (/^example\b/i.test(label)) { console.log(`     row ${i}: skipped template example — "${label}"`); continue }

  const rawQty = (row[colIdx.quantity] ?? '').trim()
  // "2 (one is broken)" is a real thing people type. Take the leading integer, and say so.
  const qty = parseInt(rawQty, 10)
  if (Number.isNaN(qty) || qty < 1) { bad(`row ${i}: "${label}" has quantity "${rawQty}" — needs a whole number 1 or more`); continue }
  if (String(qty) !== rawQty) warn(`row ${i}: quantity "${rawQty}" read as ${qty} — confirm that is right`)

  const activeRaw = colIdx.active !== undefined ? (row[colIdx.active] ?? '').trim().toLowerCase() : 'yes'
  const active = !['no', 'n', 'false', '0', 'unavailable'].includes(activeRaw)

  const item_key = deriveItemKey(label)
  if (!item_key) { bad(`row ${i}: "${label}" produces an empty item_key`); continue }
  if (seenKeys.has(item_key)) { bad(`row ${i}: "${label}" and "${seenKeys.get(item_key)}" both key to "${item_key}" — rename one`); continue }
  seenKeys.set(item_key, label)

  ITEMS.push({ item_key, label, quantity: qty, active })
}

if (!ITEMS.length) { bad('no usable item rows found'); process.exit(1) }
for (const it of ITEMS) console.log(`     ${it.active ? ' ' : '(inactive) '}${it.label}  x${it.quantity}  -> ${it.item_key}`)
ok(`${ITEMS.length} item(s), ${ITEMS.filter(i => !i.active).length} marked unavailable`)

// --- 4. What Ava will mishear ------------------------------------------------------------------
heading('4. Spoken matching (the REAL matchItem)')
// Only active items are ever loaded at call time, so only they can collide.
const pool = ITEMS.filter(i => i.active).map(({ item_key, label, quantity }) => ({ item_key, label, quantity }))

for (const it of pool) {
  const m = matchItem(pool, it.label)
  if (m.kind === 'match' && m.item.item_key === it.item_key) ok(`"${it.label}" -> ${it.item_key}`)
  else if (m.kind === 'ambiguous') bad(`"${it.label}" is AMBIGUOUS against: ${describeChoices(m.candidates)}`)
  else bad(`"${it.label}" does not resolve to itself (${m.kind})`)
}

const stop = new Set(['the', 'and', 'package', 'table', 'house', 'bounce', 'machine', 'set'])
const phrases = new Set()
for (const it of pool) for (const w of it.label.toLowerCase().split(/[^a-z0-9]+/)) {
  if (w && w.length > 2 && !stop.has(w)) phrases.add(w)
}
console.log('\n  Partial phrases a caller might say:')
for (const p of [...phrases].sort()) {
  const m = matchItem(pool, p)
  if (m.kind === 'match')          console.log(`     "${p}" -> ${m.item.item_key}`)
  else if (m.kind === 'ambiguous') warn(`"${p}" is ambiguous -> Ava must ask: "${describeChoices(m.candidates)}"`)
  else                             console.log(`     "${p}" -> no match, Ava lists everything`)
}

// --- 5. Write ------------------------------------------------------------------------------------
heading('5. Write')
if (failures) { console.log(`  BLOCKED — ${failures} failure(s). Nothing written.`); process.exit(1) }
if (!APPLY) {
  console.log(`  DRY RUN — nothing written. ${warnings} warning(s).`)
  console.log('  Re-run with --apply once the list and the labels look right.')
  process.exit(0)
}

const { error } = await supabase
  .from('client_inventory')
  .upsert(ITEMS.map(i => ({ client_domain: domain, ...i })), { onConflict: 'client_domain,item_key' })
if (error) { bad(`write failed: ${error.message}`); process.exit(1) }

// Re-read through the real loader: a write the reader does not return is not a change.
const { items, error: loadErr } = await loadInventory(supabase, domain)
if (loadErr) bad(`loadInventory failed after write: ${loadErr}`)
else if (items.length !== pool.length) bad(`wrote ${pool.length} active item(s) but the loader returns ${items.length}`)
else ok(`loader returns all ${items.length} active item(s): ${items.map(i => i.label).join(', ')}`)

heading('Verdict')
console.log(failures ? `  ${failures} FAILURE(S)` : `  Inventory applied. ${warnings} warning(s).`)
process.exit(failures ? 1 : 0)
