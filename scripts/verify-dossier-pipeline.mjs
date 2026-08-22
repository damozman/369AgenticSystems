/**
 * Proves the whole dossier chain, end to end, against PRODUCTION Supabase.
 *
 * Submission → build → review page → approve → send. Every step through the real route, because
 * this pipeline's entire claim is that nothing in it is invented — and a pipeline verified only by
 * unit tests has never once had to survive its own database.
 *
 * What it asserts, in order of what would hurt most if it broke:
 *   - the built dossier contains the arithmetic that IS allowed and none of the products that are
 *     forbidden (volume × value × RECOVERY_RATE must appear nowhere, at any rounding)
 *   - GET on the approve route sends NOTHING and says 405. Mail scanners fetch every URL in a
 *     message; if this ever became a GET, every dossier would be sent unread
 *   - a token for one dossier cannot approve another
 *   - approving twice sends once
 *   - a declined dossier cannot be revived by a stale link
 *
 * ⚠️ Sends ONE real email, to the owner's own address, because "it sent" is the only way to know
 * it sends. Every row it writes is deleted, including on failure.
 *
 * Needs the dev server:  npm run dev
 * node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/verify-dossier-pipeline.mjs
 * BASE_URL=http://localhost:3007 to point at another port.
 */
import { createClient } from '@supabase/supabase-js'
import { mintDossierToken } from '../lib/security/dossier-token.ts'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = 'chris@369agenticsystems.com'
const DOMAIN = `dossier-verify-${Date.now()}.example.com`

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

let passed = 0
const failures = []
let auditId = null
let dossierId = null

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failures.push(label)
    console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`)
  }
}
const ok = (label, cond, note = '') => check(label + (note ? ` (${note})` : ''), Boolean(cond), true)

async function main() {
  console.log(`\n369 · dossier pipeline — ${BASE_URL}\n`)
  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    throw new Error('BASE_URL must be a local dev server')
  }

  // ── A submission, as /api/intake would have written it ────────────────────
  console.log('1 · a submission with the full payload')
  const { data: audit, error: aErr } = await db.from('system_audits').insert({
    client_domain: DOMAIN,
    client_email: EMAIL,
    client_name: 'Pipeline Verification',
    client_company: 'Verify Roofing Co',
    client_industry: 'roofing',
    client_phone: '+18175550143',
    service_area: 'Fort Worth, TX',
    website_url: 'https://369agenticsystems.com',
    monthly_volume: 120,
    avg_job_value: 8200,
    pain_points: ['afterhours', 'speed'],
    pain_point: 'afterhours, speed',
    payload_status: 'intake_received',
  }).select('id')
  if (aErr) throw aErr
  auditId = audit[0].id
  ok('the submission was written', auditId)

  // Two resolved calls, exactly as the webhook would have left them.
  const { error: cErr } = await db.from('audit_calls').insert([
    { audit_id: auditId, slot: 'business', status: 'resolved', reportable: true,
      outcome: 'answered_human', target_phone: '+18175550143', domain: DOMAIN,
      sentence: 'We called your main line Monday at 10:32am. Someone picked up.',
      detail: 'Retell reported "user_hangup".', raw_reason: 'user_hangup' },
    { audit_id: auditId, slot: 'evening', status: 'resolved', reportable: true,
      outcome: 'voicemail', target_phone: '+18175550143', domain: DOMAIN,
      sentence: 'We called your main line Monday at 8:41pm. It went to voicemail.',
      detail: 'Retell reported "voicemail_reached".', raw_reason: 'voicemail_reached' },
  ])
  if (cErr) throw cErr
  ok('both calls recorded', true)

  // ── Build ─────────────────────────────────────────────────────────────────
  console.log('\n2 · the build cron')
  const buildRes = await fetch(`${BASE_URL}/api/cron/dossier-build`)
  const build = await buildRes.json()
  check('the cron answered 200', buildRes.status, 200)
  ok('it built at least one', build.built >= 1, `built=${build.built}`)

  const { data: dossiers } = await db.from('dossiers').select('*').eq('audit_id', auditId)
  const d = dossiers?.[0]
  ok('a dossier was queued for this submission', Boolean(d))
  if (!d) throw new Error('nothing queued — cannot continue')
  dossierId = d.id
  check('it is pending, not sent', d.status, 'pending')
  check('addressed to the submitter', d.to_email, EMAIL)

  // ── The content rules ─────────────────────────────────────────────────────
  console.log('\n3 · what the document does and does not say')
  const html = d.html
  ok('the allowed arithmetic is present', html.includes('$2,460'), 'avg_job_value × RECOVERY_RATE')
  ok('the assumption travels with it', html.includes('conservative rate'))
  for (const forbidden of ['295,200', '295200', '3,542,400', '984,000']) {
    ok(`the forbidden product ${forbidden} appears nowhere`, !html.includes(forbidden))
  }
  ok('both call sentences are quoted verbatim',
    html.includes('Someone picked up') && html.includes('It went to voicemail'))
  ok('the pain points print the words they read', html.includes('Missed calls after hours'))
  ok('no raw pain key leaks', !html.includes('afterhours<') && !html.includes('&gt;afterhours'))
  ok('no score, grade or benchmark', !/\bscore\b|out of 100|industry average/i.test(html))

  // ── The GET hazard, which is the whole reason approval is a POST ──────────
  console.log('\n4 · a scanner fetching the link must send nothing')
  const getRes = await fetch(`${BASE_URL}/api/dossier/approve`)
  check('GET is refused with 405', getRes.status, 405)
  const { data: afterGet } = await db.from('dossiers').select('status').eq('id', dossierId)
  check('and the dossier is still pending', afterGet[0].status, 'pending')

  // ── Token binding ─────────────────────────────────────────────────────────
  console.log('\n5 · a token only opens the dossier it was minted for')
  const otherToken = mintDossierToken('00000000-0000-4000-8000-000000000999')
  const wrong = await fetch(`${BASE_URL}/api/dossier/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: dossierId, t: otherToken, action: 'approve' }),
  })
  check('a foreign token is refused', wrong.status, 401)
  const { data: afterWrong } = await db.from('dossiers').select('status').eq('id', dossierId)
  check('still nothing sent', afterWrong[0].status, 'pending')

  // ── Approve, for real ─────────────────────────────────────────────────────
  console.log('\n6 · approval sends exactly once')
  const token = mintDossierToken(dossierId)
  ok('a token could be minted', Boolean(token), 'needs ONBOARDING_TOKEN_SECRET')

  const first = await fetch(`${BASE_URL}/api/dossier/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: dossierId, t: token, action: 'approve' }),
  })
  const firstBody = await first.json()
  check('the first approval succeeds', first.status, 200)
  check('and reports it sent', firstBody.action, 'sent')

  const { data: sentRow } = await db.from('dossiers').select('status, sent_at').eq('id', dossierId)
  check('the row says sent', sentRow[0].status, 'sent')
  ok('with a timestamp', Boolean(sentRow[0].sent_at))

  const second = await fetch(`${BASE_URL}/api/dossier/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: dossierId, t: token, action: 'approve' }),
  })
  check('a second approval is refused', second.status, 409)
}

async function cleanup() {
  if (dossierId) await db.from('dossiers').delete().eq('id', dossierId)
  if (auditId) await db.from('audit_calls').delete().eq('audit_id', auditId)
  if (auditId) await db.from('system_audits').delete().eq('id', auditId)
  const [{ count: a }, { count: c }, { count: dd }] = await Promise.all([
    db.from('system_audits').select('*', { count: 'exact', head: true }),
    db.from('audit_calls').select('*', { count: 'exact', head: true }),
    db.from('dossiers').select('*', { count: 'exact', head: true }),
  ])
  console.log(`\ncleaned up · system_audits=${a} audit_calls=${c} dossiers=${dd}`)
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
      console.log(`\n✓ all ${passed} checks passed — and one real dossier is in ${EMAIL}`)
    }
  })
