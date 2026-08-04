import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { denyIfBadRetellSecret, internalHeaders } from '@/lib/security/route-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_VERTICALS = [
  'roofing', 'hvac', 'plumbing', 'legal', 'real-estate',
  'insurance', 'saas', 'wholesale', 'dental',
]

export async function POST(request: NextRequest) {
  // Called by Retell's agent tool ("capture_lead"). Secret via x-webhook-secret
  // header or ?secret= on the tool URL — dormant until RETELL_WEBHOOK_SECRET is
  // set (and configured on the Retell tool), then required.
  const denied = denyIfBadRetellSecret(request)
  if (denied) return denied

  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Retell custom tools POST { name, call: { call_id, ... }, args: {...} }.
  // Still accept a flat body too, for direct/manual calls (e.g. Rex/Nova internal triggers, testing).
  const retellCall = raw.call as { call_id?: string } | undefined
  const source     = (raw.args ?? raw) as Record<string, unknown>

  const {
    client_domain,
    caller_phone:      raw_caller_phone,
    caller_name:       raw_caller_name,
    caller_address:    raw_caller_address,
    caller_email:      raw_caller_email,
    issue_description: raw_issue_description,
    urgency,
    vertical,
  } = source as {
    client_domain?:     string
    caller_phone?:      string
    caller_name?:       string
    caller_address?:    string
    caller_email?:      string
    issue_description?: string
    urgency?:           string
    vertical?:          string
  }

  /**
   * Tool-call markup leaking into a field value.
   *
   * Observed live on 2026-08-04: two leads landed with `caller_address` set to
   * `</antml_parameter>\n<parameter name="caller_phone">817-729-1944`. When the prompt stops
   * asking for a value but the tool schema still offers the slot, the model can spill its own
   * call delimiters into it. It happened on two different models, so this is not a quirk of one
   * of them — it is what an unfillable parameter looks like when it reaches the database.
   *
   * Dropping the field is the right call: a null address is honest, a fragment of markup is
   * corruption that a human then has to recognise as garbage. This guards every text field, not
   * just the one that failed, because the same shape can hit any of them.
   */
  const TOOL_MARKUP = /<\/?\s*(antml|parameter|invoke|function|tool)[\s:_>=]|<\/[a-z_]+>/i

  const clean = (value: unknown, field: string): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (TOOL_MARKUP.test(trimmed)) {
      console.error(`[LEAD] ✗  Dropped ${field} — tool-call markup, not a value: ${trimmed.slice(0, 80)}`)
      return undefined
    }
    return trimmed
  }

  const caller_phone      = clean(raw_caller_phone,      'caller_phone')
  const caller_name       = clean(raw_caller_name,       'caller_name')
  const caller_address    = clean(raw_caller_address,    'caller_address')
  const caller_email      = clean(raw_caller_email,      'caller_email')
  const issue_description = clean(raw_issue_description, 'issue_description')

  const resolvedVertical = vertical && VALID_VERTICALS.includes(vertical) ? vertical : null

  const call_id = retellCall?.call_id ?? (source.call_id as string | undefined)

  if (!call_id || !caller_phone) {
    return NextResponse.json(
      { error: 'Missing required fields: call_id, caller_phone' },
      { status: 400 }
    )
  }

  // Resolve Retell call_id string → Supabase call UUID for FK
  const { data: callRow, error: callError } = await supabase
    .from('calls')
    .select('id, client_domain')
    .eq('call_id', call_id)
    .maybeSingle()

  if (callError) {
    console.error('[LEAD] ✗  Call lookup failed:', callError.message)
    return NextResponse.json({ error: callError.message }, { status: 500 })
  }

  // Falls back to the demo line's client_domain if not supplied — matches call-received's convention.
  const resolvedClientDomain = client_domain ?? callRow?.client_domain ?? 'demo.369agenticsystems.com'

  // The LLM calls this tool more than once per call as it learns more about the caller (or
  // occasionally twice in one turn) — and doesn't reliably re-include every field it already
  // gave us on earlier calls. Fetch whatever's already on file for this call_id and merge,
  // so a later call with fewer fields can't blank out data an earlier call already captured.
  const { data: existingLead } = callRow?.id
    ? await supabase.from('leads').select('*').eq('call_id', callRow.id).maybeSingle()
    : { data: null }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .upsert({
      call_id:           callRow?.id ?? null,
      client_domain:     resolvedClientDomain,
      caller_phone,
      caller_name:       caller_name       ?? existingLead?.caller_name       ?? null,
      caller_address:    caller_address    ?? existingLead?.caller_address    ?? null,
      caller_email:      caller_email      ?? existingLead?.caller_email      ?? null,
      issue_description: issue_description ?? existingLead?.issue_description ?? null,
      urgency:           urgency           ?? existingLead?.urgency           ?? 'normal',
      vertical:          resolvedVertical  ?? existingLead?.vertical          ?? null,
    }, { onConflict: 'call_id' })
    .select()
    .single()

  if (leadError) {
    console.error('[LEAD] ✗  Insert failed:', leadError.message)
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  console.log(`[LEAD] ✓  Captured — ${caller_phone} @ ${resolvedClientDomain}`)

  // Fire Rex (follow-up) and Felix (conflict check, legal-only — gated inside its own route) — non-fatal.
  // Awaited (not fire-and-forget): on Vercel's serverless runtime, a function can freeze as soon as
  // it returns a response, so an un-awaited fetch risks never actually completing. Found via a real
  // call where Nova's equivalent trigger silently never fired in production.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    await Promise.allSettled([
      fetch(`${appUrl}/api/rex/trigger`, {
        method:  'POST',
        headers: internalHeaders(),
        body:    JSON.stringify({ lead_id: lead.id }),
      }).catch(err => console.error('[REX TRIGGER] Failed:', err)),

      fetch(`${appUrl}/api/felix/conflict-check`, {
        method:  'POST',
        headers: internalHeaders(),
        body:    JSON.stringify({ lead_id: lead.id }),
      }).catch(err => console.error('[FELIX TRIGGER] Failed:', err)),
    ])
  }

  return NextResponse.json({ success: true, lead })
}
