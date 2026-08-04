/**
 * Places one audit call. Run it with no arguments:
 *
 *   node scripts/place-audit-call.mjs
 *
 * Anything it needs and cannot find in .env.local, it asks for at a prompt. That is
 * deliberate: the equivalent curl is a quoting minefield in PowerShell, where `<` is a
 * reserved redirection operator and `curl` aliases to Invoke-WebRequest with different
 * flags. A command containing placeholder brackets fails to parse before it does anything.
 * Prompts have no shell syntax to get wrong.
 *
 * Preferred setup — add these to .env.local and it will not ask at all:
 *
 *   INTERNAL_API_SECRET=...              (from Vercel → Settings → Environment Variables)
 *   VERCEL_AUTOMATION_BYPASS_SECRET=...  (from Vercel → Settings → Deployment Protection)
 *   AUDIT_TEST_URL=https://...           (the deployment to call)
 *
 * That also keeps secrets out of your PowerShell history.
 *
 * Flags still work for scripted use: --url --phone --name --secret --bypass
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const args = {}
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
}

const rl = createInterface({ input: stdin, output: stdout })

/** Flag, then .env.local, then ask. Never silently proceeds without a required value. */
async function need(flag, envName, prompt, { required = true } = {}) {
  const fromFlag = args[flag]?.trim()
  if (fromFlag) return fromFlag

  const fromEnv = envName ? process.env[envName]?.trim() : undefined
  if (fromEnv) {
    console.log(`  using ${envName} from .env.local`)
    return fromEnv
  }

  const answer = (await rl.question(`  ${prompt}: `)).trim()
  if (!answer && required) {
    console.error('\n✗ Required. Nothing was dialled.')
    rl.close()
    process.exit(1)
  }
  return answer
}

console.log('\nAudit call — press Enter to skip anything optional.\n')

const url    = (await need('url', 'AUDIT_TEST_URL', 'Deployment URL')).replace(/\/$/, '')
const phone  = await need('phone', null, 'Phone number to dial (your own, for a first test)')
const secret = await need('secret', 'INTERNAL_API_SECRET', 'INTERNAL_API_SECRET')
const bypass = await need('bypass', 'VERCEL_AUTOMATION_BYPASS_SECRET',
  'Vercel protection-bypass token (Enter to skip)', { required: false })
const name   = args.name || 'Audit test'

rl.close()

const headers = { 'content-type': 'application/json', 'x-internal-secret': secret }
if (bypass) headers['x-vercel-protection-bypass'] = bypass

console.log(`\n→ POST ${url}/api/audit/call`)
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

// Vercel's protection 401 and our route's bad-secret 401 are both 401, and only one of
// them means the request actually reached the app. Tell them apart.
if (res.status === 401 && body.includes('Protected deployment')) {
  console.error('✗ 401 — blocked by Vercel Deployment Protection, not by our route.')
  console.error('  The request never reached the app. Either:')
  console.error('    · Vercel → Settings → Deployment Protection → Protection Bypass')
  console.error('      for Automation → Add Secret, then re-run and paste it, or')
  console.error('    · set Vercel Authentication to Disabled for Preview only.')
  process.exit(1)
}

if (res.status === 401) {
  // 401 vs 503 is diagnostic: the route fails closed with 503 when the variable is
  // unset, so a 401 proves the deployment HAS a secret — it just isn't this one.
  const { createHash } = await import('node:crypto')
  const fp = createHash('sha256').update(secret).digest('hex').slice(0, 8)
  console.error('✗ 401 — reached the app, but the secret did not match.\n')
  console.error(`  Local secret: ${secret.length} chars, fingerprint ${fp}`)
  if (/^["']|["']$/.test(secret)) console.error('  ⚠ It is wrapped in quotes — remove them.')
  if (secret !== secret.trim())   console.error('  ⚠ It has leading/trailing whitespace.')
  console.error('\n  This deployment returned 401 rather than 503, which means it DOES have')
  console.error('  an INTERNAL_API_SECRET — just a different one. Almost always this:')
  console.error('    1. Env var changes do NOT apply to an already-built deployment.')
  console.error('       Changing it in Vercel requires a REDEPLOY to take effect.')
  console.error('    2. Or the value you edited is scoped to Production, while the')
  console.error('       Preview scope still holds an older value.')
  console.error('\n  Check both, then use the newest deployment URL — not the old one.')
  process.exit(1)
}

const explain = {
  503: 'INTERNAL_API_SECRET is not set in that environment — the route fails closed by design',
  502: 'Retell rejected the call: check RETELL_AUDIT_AGENT_ID / RETELL_AUDIT_FROM_NUMBER',
  400: 'the number was rejected before dialling — it must be a US number',
  404: 'no such route — this deployment predates the audit branch',
  500: 'the call was placed but the row was NOT recorded (the log line has the call_id)',
}

if (!res.ok) {
  console.error(`✗ HTTP ${res.status} — ${explain[res.status] ?? 'unexpected'}`)
  console.error(`  ${body.slice(0, 300)}`)
  process.exit(1)
}

console.log(`✓ HTTP 200 — ${body}\n`)
console.log('The call is dialling. Retell resolves it asynchronously, so let it ring out,')
console.log('then confirm what was actually recorded:\n')
console.log('  node scripts/verify-audit-call.mjs')
