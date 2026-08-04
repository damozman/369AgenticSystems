/**
 * Checks that every inbound phone route can actually deliver its webhook.
 *
 *   node scripts/audit-retell-webhooks.mjs
 *
 * Catches the failure that silently dropped ten days of demo calls (2026-07-25 → 08-04):
 * the shared-secret gate was armed on `/api/call-received`, but a phone number was pinned
 * to an OLD agent version whose webhook URL predated the secret. Retell answered every
 * call normally, production returned 401 to every webhook, and not one row was written.
 *
 * Nothing surfaced it. The caller hears a working agent, Retell's dashboard shows completed
 * calls, and only the database knows. That is why this is a scheduled check and not a
 * one-off fix: arming a gate breaks every producer that did not get the new secret, and
 * agent *versions* are the easy one to miss because the published version can be correct
 * while a pinned older one is not.
 *
 * Exits non-zero if any inbound route would be rejected.
 */

import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const KEY = process.env.RETELL_API_KEY
if (!KEY) { console.error('✗ RETELL_API_KEY not set'); process.exit(1) }
const H = { authorization: `Bearer ${KEY}` }

const api = async (path) => (await fetch(`https://api.retellai.com${path}`, { headers: H })).json()

// Does production actually require the secret? If the gate is dormant, a missing secret
// is not yet a fault — but it becomes one the moment the gate is armed.
const probe = await fetch('https://369agenticsystems.com/api/call-received', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ event: 'call_started', call: { call_id: 'gate-probe', agent_id: 'none' } }),
})
const gateArmed = probe.status === 401
console.log(`\nProduction webhook gate: ${gateArmed ? 'ARMED (secret required)' : `open (HTTP ${probe.status})`}\n`)

const numbers = await api('/list-phone-numbers')
let problems = 0

for (const n of numbers) {
  const routes = n.inbound_agents ?? []
  if (!routes.length) {
    console.log(`${n.phone_number}  ⚠ no inbound agent — calls are not answered`)
    continue
  }

  for (const route of routes) {
    // An unpinned route follows the published version; a pinned one may lag it.
    const pinned = route.agent_version !== undefined && route.agent_version !== null
    const path = pinned
      ? `/get-agent/${route.agent_id}?version=${route.agent_version}`
      : `/get-agent/${route.agent_id}`
    const agent = await api(path)

    const url = agent.webhook_url
    const hasSecret = Boolean(url) && /[?&]secret=/.test(url)
    const label = `${n.phone_number}  ${agent.agent_name ?? route.agent_id}  ` +
                  `v${pinned ? route.agent_version : `${agent.version} (unpinned)`}`

    if (!url) {
      console.log(`✗ ${label}\n    no webhook_url — calls will never be recorded`)
      problems++
    } else if (gateArmed && !hasSecret) {
      console.log(`✗ ${label}\n    webhook_url has NO ?secret= but the gate is armed`)
      console.log(`    → every call on this route is dropped with a 401`)
      problems++
    } else if (!hasSecret) {
      console.log(`⚠ ${label}\n    webhook_url has no ?secret= — works only while the gate is open`)
    } else {
      console.log(`✓ ${label}`)
    }

    // A pinned version that lags the published one is how this bug happened: someone
    // fixes the agent, publishes it, and the phone number quietly keeps the old config.
    if (pinned && agent.version !== undefined && route.agent_version < agent.version) {
      console.log(`    note: pinned to v${route.agent_version}, published is v${agent.version}`)
    }
  }
}

console.log(
  problems
    ? `\n✗ ${problems} inbound route(s) would drop every call. Fix before relying on any metric.`
    : '\n✓ Every inbound route can deliver its webhook.',
)
process.exit(problems ? 1 : 0)
