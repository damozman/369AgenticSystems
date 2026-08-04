/**
 * Places one audit call against a deployment. Written as a script because the equivalent
 * curl is a quoting minefield in PowerShell — `<` is a reserved operator and `curl` is an
 * alias for Invoke-WebRequest, which takes different flags entirely.
 *
 *   node scripts/place-audit-call.mjs --url <deployment> --phone +1XXXXXXXXXX
 *
 * Options:
 *   --url     deployment base URL (no trailing slash)
 *   --phone   number to dial — use YOUR OWN for the first test
 *   --name    optional business name recorded with the call
 *   --secret  INTERNAL_API_SECRET; falls back to the env var of that name
 *   --bypass  Vercel protection-bypass token, if the deployment is protected
 *
 * Interprets every failure mode rather than dumping a status code, because the two that
 * matter look identical from outside: Vercel's own 401 for a protected deployment, and
 * our route's 401 for a bad secret.
 */

import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())

const args = {}
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
}

const url    = (args.url || '').replace(/\/$/, '')
const phone  = args.phone
const name   = args.name || 'Audit test'
const secret = args.secret || process.env.INTERNAL_API_SECRET
const bypass = args.bypass || process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!url || !phone) {
  console.error('Usage: node scripts/place-audit-call.mjs --url <deployment> --phone +1XXXXXXXXXX')
  process.exit(1)
}
if (!secret) {
  console.error('✗ No INTERNAL_API_SECRET. Pass --secret or set it in .env.local.')
  console.error('  It is not in .env.local locally — copy it from the Vercel dashboard.')
  process.exit(1)
}

const headers = {
  'content-type': 'application/json',
  'x-internal-secret': secret,
}
if (bypass) headers['x-vercel-protection-bypass'] = bypass

console.log(`→ POST ${url}/api/audit/call`)
console.log(`  dialing ${phone}${bypass ? '  (with protection bypass)' : ''}\n`)

let res, body
try {
  res = await fetch(`${url}/api/audit/call`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, business_name: name }),
  })
  body = await res.text()
} catch (err) {
  console.error(`✗ Request failed: ${err.message}`)
  process.exit(1)
}

// Vercel's protection 401 and our route's 401 are both 401. Tell them apart.
if (res.status === 401 && body.includes('Protected deployment')) {
  console.error('✗ 401 — blocked by Vercel Deployment Protection, not by our route.')
  console.error('  The request never reached the app. Options:')
  console.error('    · Vercel → Settings → Deployment Protection → generate a')
  console.error('      Protection Bypass for Automation token, then pass --bypass <token>')
  console.error('    · or set Vercel Authentication to "Disabled" for Preview')
  console.error('    · or merge to master and test in production')
  process.exit(1)
}

const explain = {
  401: 'the x-internal-secret header did not match INTERNAL_API_SECRET in that environment',
  503: 'INTERNAL_API_SECRET is not set in that environment — the route fails closed by design',
  502: 'Retell rejected the call: check RETELL_AUDIT_AGENT_ID / RETELL_AUDIT_FROM_NUMBER',
  400: 'the number was rejected before dialling — it must be a US number',
  404: 'no such route — this deployment predates the audit branch',
  500: 'the call was placed but the row was NOT recorded (check the logs for the call_id)',
}

if (!res.ok) {
  console.error(`✗ HTTP ${res.status} — ${explain[res.status] ?? 'unexpected'}`)
  console.error(`  ${body.slice(0, 300)}`)
  process.exit(1)
}

console.log(`✓ HTTP 200 — ${body}\n`)
console.log('The call is dialling. Retell resolves it asynchronously, so wait for it to')
console.log('ring out, then confirm what was recorded:\n')
console.log('  node scripts/verify-audit-call.mjs')
