/**
 * Pre-flight for the audit-call route. Checks configuration BEFORE you spend a call.
 *
 *   node scripts/preflight-audit-call.mjs
 *
 * Reports only whether each variable is present and, for non-secret ones, its value.
 * Secrets are never printed — presence is the only thing that matters here.
 *
 * This exists because the route's two failure modes are both silent from the outside:
 * a missing INTERNAL_API_SECRET returns 503 by design, and a missing agent or number
 * throws inside the dialer and surfaces only as a 502. Neither writes a row, so the
 * symptom is an empty table with no obvious cause.
 */

import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())

const present = (k) => Boolean(process.env[k]?.trim())

// [name, required, note, printValue]
const CHECKS = [
  ['INTERNAL_API_SECRET',       true,  'without this the route returns 503 and never dials', false],
  ['RETELL_API_KEY',            true,  'the dialer module throws at import without it',      false],
  ['RETELL_AUDIT_FROM_NUMBER',  false, 'falls back to RETELL_PHONE_NUMBER',                  true],
  ['RETELL_PHONE_NUMBER',       false, 'fallback outbound number',                           true],
  ['RETELL_AUDIT_AGENT_ID',     false, 'falls back to RETELL_AGENT_ID',                      true],
  ['RETELL_AGENT_ID',           false, 'fallback agent (the shared demo agent)',             true],
  ['RETELL_WEBHOOK_SECRET',     false, 'if set here it MUST match the Retell agent config',  false],
  ['NEXT_PUBLIC_SUPABASE_URL',  true,  'needed to record the call',                          true],
  ['SUPABASE_SERVICE_ROLE_KEY', true,  'needed to record the call',                          false],
]

let fatal = 0
console.log('Local .env.local:\n')

for (const [name, required, note, printValue] of CHECKS) {
  const ok = present(name)
  const mark = ok ? '✓' : required ? '✗' : '·'
  const shown = ok && printValue ? `  = ${process.env[name]}` : ''
  console.log(`  ${mark} ${name.padEnd(26)}${ok ? 'set' : 'not set'}${shown}`)
  if (!ok && required) { console.log(`      ${note}`); fatal++ }
}

// The dialer needs one of each pair, not necessarily the audit-specific one.
const haveNumber = present('RETELL_AUDIT_FROM_NUMBER') || present('RETELL_PHONE_NUMBER')
const haveAgent  = present('RETELL_AUDIT_AGENT_ID')    || present('RETELL_AGENT_ID')

if (!haveNumber) { console.log('\n  ✗ No outbound number — placeAuditCall throws, route returns 502'); fatal++ }
if (!haveAgent)  { console.log('  ✗ No agent configured — placeAuditCall throws, route returns 502');  fatal++ }

console.log(
  fatal
    ? `\n✗ ${fatal} blocking problem(s). The route cannot place a call in this environment.`
    : '\n✓ Local config is complete.',
)

console.log(`
Remember these are LOCAL values. The route only exists on the feat/audit-call-dial
branch, so a real call must go to that PR's Vercel preview — and the preview needs
the same variables set in Vercel, which .env.local does not supply.

  curl -X POST <preview-url>/api/audit/call \\
    -H 'content-type: application/json' \\
    -H 'x-internal-secret: <INTERNAL_API_SECRET>' \\
    -d '{"phone":"<your mobile>","business_name":"Preflight test"}'

  503 → INTERNAL_API_SECRET not set in Vercel
  401 → header did not match
  502 → no agent / number, or Retell rejected the create
  200 → a row lands in audit_calls as 'placed'`)

process.exit(fatal ? 1 : 0)
