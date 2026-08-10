import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getVerticalConfig } from '@/lib/verticals'
import { getDentrixContext, formatDentrixContext } from '@/lib/integrations/dentrix'
import { denyIfBadEmailIngestSecret } from '@/lib/security/route-guard'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Extract bare email from "Name <email@domain.com>" format
function parseFrom(from: string): { email: string; name: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() }
  return { name: from.trim(), email: from.trim() }
}

export async function POST(request: Request) {
  /**
   * Guarded. This was one of the last unauthenticated routes: anyone who knew the URL could POST
   * a form body and spend an Anthropic call plus a database row, as often as they liked.
   *
   * Arming a gate is normally the dangerous move here — it silently breaks every producer that
   * did not get the new secret, which caused both the funnel outage and the ten-day call outage.
   * It is safe in this one case because there are no producers: `pending_responses` has never
   * held a single row, so nothing has ever successfully delivered to this route.
   *
   * `?secret=` as well as the header, because SendGrid's Inbound Parse config offers only a URL —
   * same constraint, and the same solution, as the Retell webhook.
   */
  const denied = denyIfBadEmailIngestSecret(request)
  if (denied) return denied

  const receivedAt = new Date().toISOString()
  console.log(`[EMAIL INGEST] ▶  Incoming email — ${receivedAt}`)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    console.error('[EMAIL INGEST] ✗  Failed to parse form data')
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const rawFrom    = (formData.get('from')    as string | null) ?? ''
  const subject    = (formData.get('subject') as string | null) ?? '(no subject)'
  const textBody   = (formData.get('text')    as string | null) ?? ''
  const htmlBody   = (formData.get('html')    as string | null) ?? ''

  const { email: fromEmail, name: fromName } = parseFrom(rawFrom)
  const body = textBody.trim() || htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  if (!fromEmail || !body) {
    console.warn('[EMAIL INGEST] ✗  Missing from or body — skipping')
    return NextResponse.json({ error: 'Missing sender or body' }, { status: 400 })
  }

  console.log(`[EMAIL INGEST] ✉  From: ${fromEmail} | Subject: ${subject}`)

  /**
   * What we actually know about this person.
   *
   * `system_audits` also carries `security_score`, `seo_visibility` and `revenue_leakage`, and
   * this prompt used to feed all three to the model. **They are invented numbers.** The Gumloop
   * prompt that produced them never measured anything — it instructed the model to guess, which
   * is why five rows for one real dental practice read 45/55 and 41/54 with no scan behind them.
   * See docs/reference/gumloop-prompts-archive.md, which calls this out as the smoking gun.
   *
   * Handing invented figures to an LLM that is drafting a reply to the business they describe is
   * how a fabricated statistic ends up in front of a customer in our own words. Nothing here is
   * worth that, so only the fields a human actually typed are passed on.
   *
   * The old context also asserted "Previously audited — they've seen our report", which was
   * false for every row: `/api/intake` records a form submission, not an audit, and no report is
   * sent. A model told the prospect has seen a report will write as though they have.
   */
  const [{ data: prospect }, dentrixCtx] = await Promise.all([
    supabaseAdmin
      .from('system_audits')
      .select('client_domain, client_name, client_industry, created_at')
      .eq('client_email', fromEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getDentrixContext(fromEmail),
  ])

  const dentrixSection = formatDentrixContext(dentrixCtx)

  const prospectContext = [
    prospect
      ? `PROSPECT CONTEXT (from their own enquiry form — every field below was typed by them):
- Name: ${prospect.client_name || fromName}
- Domain: ${prospect.client_domain}
- Industry: ${prospect.client_industry || 'unknown'}
- They contacted us on: ${new Date(prospect.created_at as string).toISOString().slice(0, 10)}

We have NOT run any scan, audit or report on this business. Do not reference scores, findings,
vulnerabilities or results of any kind, and do not imply we have already sent them anything.`
      : `PROSPECT CONTEXT:
- Name: ${fromName}
- Email: ${fromEmail}
- Status: First contact — nothing on file for this address

We have NOT run any scan, audit or report on this business. Do not reference scores, findings,
vulnerabilities or results of any kind.`,
    dentrixSection ? `\n${dentrixSection}` : '',
  ].join('')

  // ── Draft response with Claude ────────────────────────────────────────────
  const config = getVerticalConfig(prospect?.client_industry)

  let rawDraft = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: config.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${prospectContext}

INBOUND EMAIL:
From: ${fromName} <${fromEmail}>
Subject: ${subject}

${body.substring(0, 3000)}

---
Draft a professional email response for the practice owner to review and send.

Format your output exactly like this:
SUBJECT: [the reply subject line]

[email body starting with a greeting]`,
        },
      ],
    })
    rawDraft = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log(`[EMAIL INGEST] ✓  Claude draft generated (${rawDraft.length} chars)`)
  } catch (err) {
    console.error('[EMAIL INGEST] ✗  Claude API error:', err)
    return NextResponse.json({ error: 'AI draft failed' }, { status: 500 })
  }

  // ── Parse subject + body from Claude output ───────────────────────────────
  const lines = rawDraft.split('\n')
  const subjectLineIdx = lines.findIndex(l => l.trimStart().startsWith('SUBJECT:'))
  const draftSubject = subjectLineIdx >= 0
    ? lines[subjectLineIdx].replace(/^SUBJECT:\s*/i, '').trim()
    : `Re: ${subject}`
  const draftBody = lines
    .slice(subjectLineIdx >= 0 ? subjectLineIdx + 1 : 0)
    .join('\n')
    .trim()

  // ── Store in pending_responses ────────────────────────────────────────────
  const { error: dbError } = await supabaseAdmin
    .from('pending_responses')
    .insert({
      prospect_email:   fromEmail,
      prospect_name:    fromName,
      prospect_domain:  prospect?.client_domain ?? null,
      original_subject: subject,
      original_body:    body.substring(0, 5000),
      draft_subject:    draftSubject,
      draft_body:       draftBody,
      status:           'pending',
      created_at:       receivedAt,
    })

  if (dbError) {
    console.error(`[EMAIL INGEST] ✗  Supabase insert failed — ${dbError.message}`)
    return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
  }

  console.log(`[EMAIL INGEST] ✓  Draft stored — pending approval`)
  return NextResponse.json({ success: true }, { status: 200 })
}
