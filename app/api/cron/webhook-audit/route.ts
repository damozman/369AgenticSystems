import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * Daily check that every inbound phone route can actually deliver its webhook.
 *
 * This is the scheduled form of `scripts/audit-retell-webhooks.mjs`, which exists because the
 * demo line answered calls normally for ten days (2026-07-25 → 08-04) and recorded none of them.
 * The shared-secret gate had been armed on `/api/call-received` while a phone number stayed
 * pinned to an older agent version whose webhook URL predated the secret. Retell reported
 * completed calls, callers heard a working agent, and only the database knew.
 *
 * Nothing about that failure is visible from the outside, which is the whole argument for a cron:
 * the fault is silent by construction and costs nothing to check daily.
 *
 * Alerts only on a problem. A green run every morning trains you to ignore the mail.
 */

const resend = new Resend(process.env.RESEND_API_KEY)

const RETELL_API = 'https://api.retellai.com'

interface Problem {
  severity: 'broken' | 'warning'
  route:    string
  detail:   string
}

async function retell(path: string, key: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${RETELL_API}${path}`, { headers: { authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`Retell ${path} → HTTP ${res.status}`)
  return res.json()
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.RETELL_API_KEY
  if (!key) {
    console.error('[WEBHOOK AUDIT] RETELL_API_KEY is not set — cannot audit')
    return NextResponse.json({ error: 'RETELL_API_KEY is not set' }, { status: 500 })
  }

  // The gate enforces exactly when this env var is set (see denyIfBadRetellSecret), so reading it
  // here is the same question the guard asks — no need to self-probe over HTTP.
  const expectedSecret = process.env.RETELL_WEBHOOK_SECRET
  const gateArmed = Boolean(expectedSecret)

  const problems: Problem[] = []
  let routesChecked = 0

  try {
    const numbers = await retell('/list-phone-numbers', key) as unknown as Array<Record<string, unknown>>

    for (const n of numbers) {
      const phone  = String(n.phone_number ?? 'unknown')
      const routes = (n.inbound_agents ?? []) as Array<{ agent_id: string; agent_version?: number | null }>

      if (!routes.length) {
        problems.push({ severity: 'warning', route: phone, detail: 'No inbound agent — calls are not answered.' })
        continue
      }

      for (const route of routes) {
        routesChecked++

        // An unpinned route follows the published version; a pinned one can lag it. Fetching the
        // pinned version specifically is the point — the published agent can be perfectly correct
        // while the version the number actually uses is not. That is how the outage happened.
        const pinned = route.agent_version !== undefined && route.agent_version !== null

        let agent: Record<string, unknown>
        try {
          agent = await retell(
            pinned ? `/get-agent/${route.agent_id}?version=${route.agent_version}` : `/get-agent/${route.agent_id}`,
            key,
          )
        } catch (e) {
          // Contained for the same reason as the URL parse below: one unreadable agent must not
          // cost visibility into every other route. A route whose agent cannot be read is itself
          // suspect — a version pinned to something that no longer exists looks exactly like this.
          problems.push({
            severity: 'broken',
            route:    `${phone} · ${route.agent_id}${pinned ? ` · v${route.agent_version}` : ''}`,
            detail:   `Could not read this agent from Retell: ${e instanceof Error ? e.message : String(e)}`,
          })
          continue
        }

        const name  = String(agent.agent_name ?? route.agent_id)
        const label = `${phone} · ${name} · v${pinned ? route.agent_version : `${agent.version} (unpinned)`}`
        const url   = agent.webhook_url as string | undefined

        if (!url) {
          problems.push({ severity: 'broken', route: label, detail: 'No webhook_url — calls will never be recorded.' })
          continue
        }

        // Parsed defensively: one unparseable URL must not abort the audit and leave every other
        // route unchecked. A cron that dies halfway reports nothing, and nothing reads as healthy.
        let urlSecret: string | null = null
        try {
          urlSecret = new URL(url).searchParams.get('secret')
        } catch {
          problems.push({ severity: 'broken', route: label, detail: `webhook_url is not a valid URL: ${url}` })
          continue
        }

        if (gateArmed && !urlSecret) {
          problems.push({
            severity: 'broken',
            route:    label,
            detail:   'webhook_url carries no ?secret= but the gate is armed — every call on this route is dropped with a 401.',
          })
        } else if (gateArmed && urlSecret !== expectedSecret) {
          // The rotation case. A URL that has *a* secret looks correct to any check that only asks
          // whether one is present, which is why this compares the value: two places holding the
          // secret must match exactly, and one of them can be rotated without the other.
          problems.push({
            severity: 'broken',
            route:    label,
            detail:   'webhook_url carries a secret that does NOT match RETELL_WEBHOOK_SECRET — every call on this route is dropped with a 401.',
          })
        } else if (!urlSecret) {
          problems.push({
            severity: 'warning',
            route:    label,
            detail:   'webhook_url has no ?secret= — works only while the gate stays open.',
          })
        }

        // Not a failure on its own, but it is the shape the outage took: someone fixes an agent,
        // publishes it, and the phone number quietly keeps pointing at the old config.
        const published = agent.version as number | undefined
        if (pinned && published !== undefined && (route.agent_version as number) < published) {
          problems.push({
            severity: 'warning',
            route:    label,
            detail:   `Pinned to v${route.agent_version} while v${published} is published — the number is not following the current agent.`,
          })
        }
      }
    }
  } catch (e) {
    // An audit that cannot run is itself worth an email: silence from this cron must never be
    // mistaken for a clean bill of health.
    const message = e instanceof Error ? e.message : String(e)
    console.error('[WEBHOOK AUDIT] ✗  Audit could not complete:', message)
    await notify(`⚠️ Webhook audit could not run`, `<p>The daily Retell webhook audit failed before it finished.</p><pre>${escapeHtml(message)}</pre><p>Inbound routes were NOT verified today.</p>`)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const broken = problems.filter(p => p.severity === 'broken')

  if (!problems.length) {
    console.log(`[WEBHOOK AUDIT] ✓  ${routesChecked} inbound route(s) can all deliver.`)
    return NextResponse.json({ ok: true, routesChecked, problems: 0 })
  }

  console.warn(`[WEBHOOK AUDIT] ${broken.length} broken, ${problems.length - broken.length} warning(s)`)

  const rows = problems.map(p => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);color:${p.severity === 'broken' ? '#F87171' : '#D4AF37'};font-family:monospace;font-size:11px;white-space:nowrap;">
        ${p.severity === 'broken' ? 'DROPPING CALLS' : 'warning'}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);color:#F0F0F0;font-size:12px;">
        <strong>${escapeHtml(p.route)}</strong><br>
        <span style="color:#94A3B8;">${escapeHtml(p.detail)}</span>
      </td>
    </tr>`).join('')

  await notify(
    broken.length
      ? `🚨 ${broken.length} phone route(s) are dropping every call`
      : `⚠️ Webhook audit: ${problems.length} warning(s)`,
    `<p style="color:#94A3B8;font-size:13px;">${routesChecked} inbound route(s) checked. The gate is <strong style="color:#F0F0F0;">${gateArmed ? 'ARMED' : 'open'}</strong>.</p>
     <table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
     ${broken.length ? `<p style="color:#F87171;font-size:12px;margin-top:16px;">A route marked DROPPING CALLS records nothing. Callers still hear a working agent, so no metric will show this.</p>` : ''}
     <p style="color:#475569;font-size:11px;margin-top:16px;font-family:monospace;">node scripts/audit-retell-webhooks.mjs — same check, locally.</p>`,
  )

  return NextResponse.json({ ok: broken.length === 0, routesChecked, problems: problems.length, broken: broken.length })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Resend reports API failures by RETURNING `{ error }`, it does not throw — so a try/catch alone
 * silently swallows a rejected send. An alert that never arrives is indistinguishable from having
 * nothing to report, which is the exact failure this whole cron exists to prevent, so the returned
 * error is inspected as well as the thrown one. Confirmed against a deliberately invalid API key:
 * the send failed and nothing was logged until this checked the result.
 */
async function notify(subject: string, bodyHtml: string) {
  try {
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      'chris@369agenticsystems.com',
      subject,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#0A0A0A;color:#F0F0F0;padding:28px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D4AF37;font-family:monospace;">369 Agentic Systems · Webhook Audit</p>
        ${bodyHtml}
      </div>`,
    })
    if (error) {
      console.error(`[WEBHOOK AUDIT] ✗  Alert email REJECTED by Resend: ${error.name} — ${error.message}`)
      return
    }
    console.log(`[WEBHOOK AUDIT] ✓  Alert email sent: ${subject}`)
  } catch (e) {
    console.error('[WEBHOOK AUDIT] ✗  Could not send alert email:', e)
  }
}
