import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { dentalConfig } from '@/lib/verticals/dental'
import { getDentrixContext, formatDentrixContext } from '@/lib/integrations/dentrix'

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

  // ── Look up prospect context + Dentrix patient data in parallel ──────────
  const [{ data: prospect }, dentrixCtx] = await Promise.all([
    supabaseAdmin
      .from('system_audits')
      .select('client_domain, client_name, client_industry, security_score, seo_visibility, revenue_leakage')
      .eq('client_email', fromEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getDentrixContext(fromEmail),
  ])

  const dentrixSection = formatDentrixContext(dentrixCtx)

  const prospectContext = [
    prospect
      ? `PROSPECT CONTEXT (from prior audit):
- Name: ${prospect.client_name || fromName}
- Domain: ${prospect.client_domain}
- Industry: ${prospect.client_industry || 'dental'}
- Security Score: ${prospect.security_score ?? 'N/A'}/100
- SEO Visibility: ${prospect.seo_visibility ?? 'N/A'}/100
- Revenue Leakage: ${prospect.revenue_leakage || 'Unknown'}
- Status: Previously audited — they've seen our report`
      : `PROSPECT CONTEXT:
- Name: ${fromName}
- Email: ${fromEmail}
- Status: First contact — no prior audit on file`,
    dentrixSection ? `\n${dentrixSection}` : '',
  ].join('')

  // ── Draft response with Claude ────────────────────────────────────────────
  const config = dentalConfig

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
