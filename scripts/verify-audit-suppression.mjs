/**
 * Proves "don't call me again" actually stops the call.
 *
 * This is the one promise on the callback line that Ava says out loud, so it is the one that has
 * to be true. Everything here runs against the REAL route and PRODUCTION Supabase — the point is
 * to check the consumer's view (what the dispatcher would do) rather than the producer's (what the
 * suppress route says it did).
 *
 * What it asserts:
 *   - a refusal records the number, normalised to E.164 whatever format it arrives in
 *   - a call already SCHEDULED is CANCELLED, not left standing. We place two calls, so the
 *     likeliest moment to ring back is between them, and a refusal that let the evening call
 *     through would be worse than no refusal at all
 *   - the dispatcher then refuses that number even if a fresh row is scheduled afterwards
 *   - asking twice is idempotent, not an error
 *   - a call already placed is left alone — it has happened, and rewriting history is not opting out
 *
 * Buys nothing, dials nothing. Every row it writes is deleted, including on failure.
 *
 * Needs the dev server:  npm run dev
 * node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-audit-suppression.mjs
 * BASE_URL=http://localhost:3007 to point at another port.
 */
import { createClient } from '@supabase/supabase-js'
import { decideOne } from '../lib/audit-dispatch.ts'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
// A number that can never belong to anyone: 555-01xx is reserved for fiction.
const PHONE_RAW = '(817) 555-0142'
const PHONE_E164 = '+18175550142'
const ON = { AUDIT_CALLS_ENABLED: 'true' }

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

let passed = 0
const failures = []
const madeRows = []

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failures.push(label)
    console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`)
  }
}

async function scheduleCall(slot, status = 'scheduled') {
  const { data, error } = await db.from('audit_calls').insert({
    target_phone: PHONE_E164,
    domain: 'suppression-verify',
    slot,
    status,
    scheduled_for: new Date(Date.now() - 60_000).toISOString(),
  }).select('*')
  if (error) throw error
  madeRows.push(data[0].id)
  return data[0]
}

async function suppress(phone, reason = 'requested') {
  const res = await fetch(`${BASE_URL}/api/audit/suppress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.INTERNAL_API_SECRET ? { 'x-internal-secret': process.env.INTERNAL_API_SECRET } : {}),
    },
    body: JSON.stringify({ phone, reason, source: 'verify-script' }),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function main() {
  console.log(`\n369 · audit suppression — ${BASE_URL}\n`)
  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    throw new Error('BASE_URL must be a local dev server')
  }

  // Start clean, in case a previous run died mid-way.
  await db.from('audit_suppressions').delete().eq('phone', PHONE_E164)
  await db.from('audit_calls').delete().eq('domain', 'suppression-verify')

  // ── 1 · a pending call is cancelled by the refusal ─────────────────────────
  console.log('1 · a refusal cancels the call that has not happened yet')
  const pending = await scheduleCall('evening')
  const before = decideOne(pending, new Date(), ON, new Set())
  check('the dispatcher would have dialled it', before.place, true)

  const r = await suppress(PHONE_RAW)      // deliberately NOT E.164
  check('the route accepted it', r.status, 200)
  check('the number was normalised to E.164', r.body.phone, PHONE_E164)
  check('it reports the cancellation', r.body.cancelled, 1)

  const { data: after } = await db.from('audit_calls').select('status').eq('id', pending.id)
  check('the pending call is CANCELLED, not left standing', after?.[0]?.status, 'cancelled')

  // ── 2 · the dispatcher is the real gate ────────────────────────────────────
  console.log('\n2 · the dispatcher refuses the number afterwards')
  const { data: sup } = await db.from('audit_suppressions').select('phone, reason').eq('phone', PHONE_E164)
  check('the suppression was recorded', sup?.[0]?.phone, PHONE_E164)
  check('with the reason given', sup?.[0]?.reason, 'requested')

  // A row scheduled AFTER the refusal — the case a cancel-only design would miss entirely.
  const fresh = await scheduleCall('business')
  const suppressed = new Set((await db.from('audit_suppressions').select('phone')).data.map(x => x.phone))
  const decision = decideOne(fresh, new Date(), ON, suppressed)
  check('a newly scheduled call is still refused', decision.place, false)
  check('and says why', decision.reason, 'suppressed')

  // ── 3 · asking twice ───────────────────────────────────────────
  console.log('\n3 · asking twice is not an error, and sweeps anything scheduled since')
  // Someone asking a second time is a person who did not trust the first answer. It must not
  // error — and it must also catch rows created after the first refusal, which is exactly the
  // `fresh` row scheduled above.
  const again = await suppress(PHONE_RAW)
  check('still 200', again.status, 200)
  check('it sweeps the row scheduled after the first refusal', again.body.cancelled, 1)

  const third = await suppress(PHONE_RAW)
  check('and with nothing pending, cancels nothing', third.body.cancelled, 0)

  // ── 4 · what suppression must NOT do ───────────────────────────────────────
  console.log('\n4 · a call that already happened is left alone')
  // Opting out stops future calls. It does not rewrite the record of one that was placed —
  // that call is evidence of what we did, and the dossier may already have reported it.
  const placed = await scheduleCall('business', 'placed')
  await suppress(PHONE_RAW)
  const { data: stillPlaced } = await db.from('audit_calls').select('status').eq('id', placed.id)
  check('a placed call keeps its status', stillPlaced?.[0]?.status, 'placed')

  // ── 5 · junk in ────────────────────────────────────────────────────────────
  console.log('\n5 · a number we cannot dial is refused, not silently accepted')
  // Answering "done" to an unusable number would be the lie this whole table exists to prevent.
  const junk = await suppress('not a phone number')
  check('rejected with 400', junk.status, 400)
}

async function cleanup() {
  await db.from('audit_suppressions').delete().eq('phone', PHONE_E164)
  const { data } = await db.from('audit_calls').delete().eq('domain', 'suppression-verify').select('id')
  console.log(`\ncleaned up ${data?.length ?? 0} call row(s) and the suppression`)
}

main()
  .then(cleanup, async err => {
    await cleanup()
    console.error(`\n✗ ${err.message}`)
    process.exitCode = 1
  })
  .then(() => {
    if (failures.length) {
      console.log(`\n✗ ${passed} passed, ${failures.length} FAILED:`)
      for (const f of failures) console.log(`    · ${f}`)
      process.exitCode = 1
    } else if (process.exitCode !== 1) {
      console.log(`\n✓ all ${passed} checks passed`)
    }
  })
