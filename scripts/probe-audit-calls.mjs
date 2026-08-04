/**
 * Probes the live database for the audit_calls table, column by column.
 *
 * Run after applying supabase/migrations/2026-08-03-audit-calls.sql:
 *
 *   node scripts/probe-audit-calls.mjs
 *
 * Exists because schema.sql is not production. On 2026-07-12 three tables were found
 * drifted from what the code assumed — call_ended threw 500s, onboarding threw, and the
 * questionnaire table was missing entirely. A migration that "ran fine" is not evidence;
 * asking the live database is.
 *
 * Reads credentials from .env.local via Next's own loader and prints structure only —
 * never row contents, never the credentials themselves.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

// Same loader `next build` uses, so this sees exactly what the app sees.
nextEnv.loadEnvConfig(process.cwd())

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  process.exit(1)
}

const db = createClient(url, key)

// Every column the code actually writes. Probed individually: selecting them together
// fails on the first missing one and hides the rest.
const COLUMNS = [
  'id', 'target_phone', 'business_name', 'domain', 'vertical', 'call_id', 'status',
  'reportable', 'outcome', 'unreportable', 'sentence', 'detail', 'raw_reason',
  'called_at', 'resolved_at',
]

const { error: tableError, count } = await db
  .from('audit_calls')
  .select('*', { count: 'exact', head: true })

if (tableError) {
  console.error(`✗ audit_calls is not queryable: ${tableError.message}`)
  console.error('  The migration has not applied. Nothing else below will be meaningful.')
  process.exit(1)
}

console.log(`✓ audit_calls exists (${count ?? 0} rows)`)

const missing = []
for (const column of COLUMNS) {
  const { error } = await db.from('audit_calls').select(column).limit(1)
  if (error) missing.push(`${column} — ${error.message}`)
}

if (missing.length) {
  console.error(`✗ ${missing.length} of ${COLUMNS.length} columns missing or unreadable:`)
  for (const m of missing) console.error(`    ${m}`)
  process.exit(1)
}

console.log(`✓ all ${COLUMNS.length} columns present and readable`)

// The CHECK constraints are what stop a bad enum value reaching a prospect-facing
// sentence, so confirm they are actually enforced rather than assumed.
const probeId = `probe-${Date.now()}`
const { error: checkError } = await db
  .from('audit_calls')
  .insert({ call_id: probeId, target_phone: '+15555550100', status: 'not_a_valid_status' })

if (checkError) {
  console.log('✓ status CHECK constraint is enforced')
} else {
  console.error('✗ status CHECK constraint did NOT reject an invalid value — cleaning up')
  await db.from('audit_calls').delete().eq('call_id', probeId)
  process.exit(1)
}

console.log('\nReady. One real call to your own phone is the remaining test:')
console.log('  → expect a `placed` row, then `resolved` with an honest sentence,')
console.log('  → and nothing new in `calls`.')
