import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const resend    = new Resend(process.env.RESEND_API_KEY)

const OWNER_EMAIL = 'chris@369agenticsystems.com'
const FROM        = 'Felix · 369 Agentic Systems <chris@369agenticsystems.com>'

interface ConflictResult {
  conflictFound: boolean
  reason: string
}

async function checkConflict(
  prospectName: string,
  caseType: string,
  existingLeads: { caller_name: string | null; issue_description: string | null }[]
): Promise<ConflictResult> {
  const roster = existingLeads
    .filter(l => l.caller_name)
    .map(l => `- ${l.caller_name}${l.issue_description ? `: ${l.issue_description}` : ''}`)
    .join('\n') || '(no prior intakes on file)'

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: 'You are Felix, a conflict-of-interest check specialist for a law firm. Given a new prospective client ' +
      'and a roster of the firm\'s existing clients/prior intakes, determine if there is a plausible conflict of interest ' +
      '(e.g. the new prospect is named as an adverse party in an existing matter, or is already represented, or the two ' +
      'parties appear to be on opposite sides of the same dispute). Be conservative — only flag a real, plausible conflict, ' +
      'not just a coincidental name similarity or shared case type. ' +
      'Respond in exactly this format:\nCONFLICT_FOUND: YES or NO\nREASON: [one sentence]',
    messages: [
      {
        role: 'user',
        content: `NEW PROSPECT: ${prospectName}\nCASE TYPE: ${caseType}\n\nEXISTING CLIENTS / PRIOR INTAKES:\n${roster}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const conflictFound = /CONFLICT_FOUND:\s*YES/i.test(text)
  const reasonMatch = text.match(/REASON:\s*(.+)/i)
  return { conflictFound, reason: reasonMatch?.[1]?.trim() ?? 'No reason parsed from response' }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lead_id } = body as { lead_id?: string }
  if (!lead_id) {
    return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, client_domain, caller_name, issue_description, vertical')
    .eq('id', lead_id)
    .maybeSingle()

  if (leadError || !lead || !lead.caller_name) {
    console.error('[FELIX] ✗  Lead lookup failed:', leadError?.message ?? 'not found or missing name')
    return NextResponse.json({ error: 'Lead not found or missing name' }, { status: 404 })
  }

  // Prefer Ava's live classification on the lead (covers the shared demo line, which has
  // no real subscription row); fall back to the client's real subscription for paying customers.
  let isLegal = lead.vertical === 'legal'
  if (!isLegal && !lead.vertical) {
    const { data: subscription } = await supabase
      .from('agent_subscriptions')
      .select('vertical')
      .eq('client_domain', lead.client_domain)
      .maybeSingle()
    isLegal = subscription?.vertical === 'legal'
  }

  if (!isLegal) {
    return NextResponse.json({ skipped: 'not a legal vertical client' })
  }

  const { data: priorLeads } = await supabase
    .from('leads')
    .select('caller_name, issue_description')
    .eq('client_domain', lead.client_domain)
    .neq('id', lead_id)
    .limit(200)

  let result: ConflictResult
  try {
    result = await checkConflict(lead.caller_name, lead.issue_description ?? 'Unknown', priorLeads ?? [])
  } catch (e) {
    console.error('[FELIX] Claude conflict check failed:', e)
    return NextResponse.json({ error: 'Conflict check failed' }, { status: 500 })
  }

  await supabase.from('conflict_checks').insert({
    intake_lead_id:  lead_id,
    client_domain:   lead.client_domain,
    prospect_name:   lead.caller_name,
    case_type:       lead.issue_description ?? null,
    conflict_found:  result.conflictFound,
    conflict_detail: result.reason,
    flagged_at:      result.conflictFound ? new Date().toISOString() : null,
  })

  if (result.conflictFound) {
    try {
      await resend.emails.send({
        from:    FROM,
        to:      OWNER_EMAIL,
        subject: `⚠️ CONFLICT DETECTED — ${lead.caller_name} (${lead.client_domain})`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#FFFFFF;padding:40px 32px;border-radius:12px;border:2px solid #EF4444;">
            <p style="margin:0 0 8px;font-size:12px;font-family:monospace;color:#EF4444;text-transform:uppercase;letter-spacing:0.15em;">
              // CONFLICT OF INTEREST DETECTED
            </p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#FFFFFF;">${lead.caller_name}</h1>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
              <tr><td style="padding:6px 0;color:#64748B;width:120px;">Client domain</td><td style="padding:6px 0;color:#FFFFFF;">${lead.client_domain}</td></tr>
              <tr><td style="padding:6px 0;color:#64748B;">Case type</td><td style="padding:6px 0;color:#FFFFFF;">${lead.issue_description ?? 'Unknown'}</td></tr>
            </table>
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#FCA5A5;line-height:1.6;">${result.reason}</p>
            </div>
            <p style="margin:20px 0 0;font-size:13px;color:#64748B;">— Felix, Conflict Check Agent · 369 Agentic Systems</p>
          </div>
        `,
      })
    } catch (e) {
      console.error('[FELIX] Alert email failed:', e)
    }
  }

  console.log(`[FELIX] ✓  Checked ${lead.caller_name} — conflict=${result.conflictFound}`)
  return NextResponse.json({ success: true, conflictFound: result.conflictFound })
}
