/**
 * Verifies a real audit call end to end, against the live database.
 *
 *   node scripts/verify-audit-call.mjs
 *
 * Checks the three things that can independently be wrong:
 *   1. the row was written and resolved by the webhook (not left at 'placed'),
 *   2. the resolved outcome produced an honest sentence — or correctly produced none,
 *   3. NOTHING landed in `calls`, which is the regression that would quietly inflate a
 *      client's dashboard, ROI figure and weekly digest with a call their agent never took.
 *
 * Phone numbers are masked: this output tends to get pasted into PRs.
 */

import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const mask = (p) => (p ? p.slice(0, -7) + '••••' + p.slice(-3) : '—')

const { data: calls, error } = await db
  .from('audit_calls')
  .select('*')
  .order('called_at', { ascending: false })
  .limit(5)

if (error) {
  console.error(`✗ Could not read audit_calls: ${error.message}`)
  process.exit(1)
}

if (!calls.length) {
  console.error('✗ No rows in audit_calls — the trigger route never wrote one.')
  console.error('  Check: did /api/audit/call return 503 (INTERNAL_API_SECRET unset)?')
  process.exit(1)
}

console.log(`Found ${calls.length} audit call(s). Most recent first:\n`)

let problems = 0

for (const c of calls) {
  console.log(`  ${mask(c.target_phone)}  ${c.business_name || '(unnamed)'}`)
  console.log(`    status      ${c.status}`)
  console.log(`    call_id     ${c.call_id ?? '—'}`)
  console.log(`    raw_reason  ${c.raw_reason ?? '—'}`)
  console.log(`    reportable  ${c.reportable === null ? '—' : c.reportable}`)
  console.log(`    outcome     ${c.outcome ?? c.unreportable ?? '—'}`)
  console.log(`    sentence    ${c.sentence ? `"${c.sentence}"` : '(none)'}`)

  if (c.status === 'placed') {
    console.log('    ⚠ still `placed` — the call_ended webhook never resolved it.')
    console.log('      Check: is RETELL_WEBHOOK_SECRET set on both Vercel and the Retell agent?')
    problems++
  }

  // The invariant that matters: a reportable call has a sentence, an unreportable one
  // must have none. A sentence on an unreportable call is a fabricated finding.
  if (c.status === 'resolved') {
    if (c.reportable && !c.sentence) {
      console.log('    ✗ reportable but no sentence — nothing to show the prospect.')
      problems++
    }
    if (c.reportable === false && c.sentence) {
      console.log('    ✗ NOT reportable yet carries a sentence — this is a fabricated finding.')
      problems++
    }
    if (c.reportable === false) {
      console.log('    ✓ correctly excluded — establishes nothing, carries no claim.')
    }
    if (c.reportable && c.sentence) {
      console.log('    ✓ honest finding recorded.')
    }
  }
  console.log()
}

// ── The regression check ──────────────────────────────────────────────────────
// Audit calls share the Retell account with inbound client calls. If the metadata
// divert in /api/call-received failed, the call would also appear here.
const callIds = calls.map(c => c.call_id).filter(Boolean)
if (callIds.length) {
  const { data: leaked, error: leakError } = await db
    .from('calls')
    .select('call_id, client_domain')
    .in('call_id', callIds)

  if (leakError) {
    console.error(`⚠ Could not check the calls table: ${leakError.message}`)
  } else if (leaked.length) {
    console.error(`✗ LEAK — ${leaked.length} audit call(s) also filed in \`calls\`:`)
    for (const l of leaked) console.error(`    ${l.call_id} → ${l.client_domain}`)
    console.error('  This inflates that client\'s dashboard, ROI figure and weekly digest.')
    console.error('  The metadata divert in /api/call-received is not working.')
    problems++
  } else {
    console.log(`✓ No audit call leaked into \`calls\` (checked ${callIds.length} call_id(s)).`)
  }
}

process.exit(problems ? 1 : 0)
