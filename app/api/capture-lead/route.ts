import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildBookingEventPatch, getProviderForClient } from '@/lib/calendar'
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
    sms_consent,
  } = source as {
    client_domain?:     string
    caller_phone?:      string
    caller_name?:       string
    caller_address?:    string
    caller_email?:      string
    issue_description?: string
    urgency?:           string
    vertical?:          string
    /**
     * Did the caller agree, out loud, to be texted?
     *
     * A2P 10DLC campaigns are rejected on proof of opt-in more than on anything else, and a
     * consumer calling a business is not consent to send them messages. Ava asks; this records
     * the answer. Absent means no — silence is never consent.
     */
    sms_consent?:       boolean | string
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

  /**
   * SMS consent, and the exact sentence behind it.
   *
   * Only ever written when the caller said yes — `capture_lead` fires several times per call, and
   * an absent flag on a later invocation must not erase a yes given on an earlier one. Consent is
   * also never revoked here: that is what STOP is for, on the inbound path.
   *
   * The timestamp is not decoration. "When did they agree?" is the first question asked after a
   * complaint, and a flag with no time is the record that proves we were not keeping records.
   */
  /**
   * `'granted'` joins `true` as of 2026-08-20.
   *
   * As an optional boolean, the parameter was simply omitted on two consecutive live calls where
   * Ava had asked and the caller had said yes — so a real verbal opt-in recorded as `false`.
   * It is now a REQUIRED enum whose third value is `'not_asked'`, which keeps the property the
   * boolean was optional to protect: the model is never cornered into inventing a consent answer,
   * because "I did not ask" is one of the things it can truthfully say.
   *
   * Anything that is not an explicit grant is not consent — `'declined'`, `'not_asked'`, absent
   * and malformed all fall through to no consent, which is the safe direction.
   */
  const grantedConsent = sms_consent === true || sms_consent === 'true' || sms_consent === 'granted'
  const consentPatch = grantedConsent
    ? {
        sms_consent:        true,
        sms_consent_at:     existingLead?.sms_consent_at ?? new Date().toISOString(),
        sms_consent_source: 'Verbal opt-in on the recorded call, captured by the receptionist agent.',
      }
    : {}

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
      ...consentPatch,
    }, { onConflict: 'call_id' })
    .select()
    .single()

  if (leadError) {
    console.error('[LEAD] ✗  Insert failed:', leadError.message)
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  console.log(`[LEAD] ✓  Captured — ${caller_phone} @ ${resolvedClientDomain}`)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  /**
   * Adopt a booking that was made before this lead existed.
   *
   * The agent does not reliably capture the lead first. On both real calls of 2026-08-04 it ran
   * book_appointment 27s and 41s AHEAD of capture_lead, so /api/book-appointment found no lead and
   * wrote `bookings.lead_id = null`. Nova then read that null, concluded there was no caller email,
   * and recorded `skipped_no_email` — for two callers whose email address arrived moments later.
   * Both bookings still read `confirmation_sent = false` today.
   *
   * Reordering the prompt would not fix this: the tool-call order is the model's to choose, and
   * betting the confirmation on it is the same class of coupling that has already broken twice.
   * Linking here — at the moment the missing half arrives — works whichever order they come in.
   */
  if (callRow?.id) {
    const { data: orphan } = await supabase
      .from('bookings')
      .select('id, lead_id, confirmation_sent, calendar_event_id, service_type, location')
      .eq('call_id', callRow.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (orphan) {
      if (!orphan.lead_id) {
        const { error: linkError } = await supabase
          .from('bookings')
          .update({ lead_id: lead.id })
          .eq('id', orphan.id)

        if (linkError) console.error('[LEAD] ✗  Could not link booking to lead:', linkError.message)
        else console.log(`[LEAD] ✓  Linked booking ${orphan.id} → lead ${lead.id}`)
      }

      // Retry the confirmation now that there is an address to send it to. `confirmation_sent`
      // only goes true on a real send, so a false here means nothing has reached the caller and
      // re-firing cannot duplicate. capture_lead runs several times per call, which makes this a
      // retry rather than a one-shot — the send stops re-attempting as soon as one succeeds.
      /**
       * Put the caller's name on the calendar event.
       *
       * Same race, same fix as the lead link above. The event was created seconds before this
       * lead existed, so it currently reads "Appointment — (817) 555-0123" on the owner's
       * calendar; now that there is a name, an email and possibly a job address, it can say who
       * is actually coming.
       *
       * Non-fatal, and it never touches the times — see buildBookingEventPatch. capture_lead
       * runs several times per call, so a failure here is retried naturally by the next one.
       */
      if (orphan.calendar_event_id) {
        try {
          const provider = await getProviderForClient(supabase, resolvedClientDomain)
          if (provider) {
            await provider.updateEvent(orphan.calendar_event_id, buildBookingEventPatch({
              serviceType:   orphan.service_type,
              location:      orphan.location,
              callerName:    lead.caller_name,
              callerPhone:   lead.caller_phone,
              callerEmail:   lead.caller_email,
              callerAddress: lead.caller_address,
            }))
            console.log(`[LEAD] ✓  Updated calendar event ${orphan.calendar_event_id} with caller details`)
          }
        } catch (e) {
          console.error('[LEAD] Calendar event update failed:', (e as Error).message)
        }
      }

      if (!orphan.confirmation_sent && lead.caller_email && appUrl) {
        await fetch(`${appUrl}/api/nova/booking-confirmation`, {
          method:  'POST',
          headers: internalHeaders(),
          body:    JSON.stringify({ booking_id: orphan.id }),
        })
          .then(r => console.log(`[LEAD] ✓  Re-fired booking confirmation for ${orphan.id} (HTTP ${r.status})`))
          .catch(err => console.error('[NOVA RETRIGGER] Failed:', err))
      }
    }
  }

  // Fire Rex (follow-up) and Felix (conflict check, legal-only — gated inside its own route) — non-fatal.
  // Awaited (not fire-and-forget): on Vercel's serverless runtime, a function can freeze as soon as
  // it returns a response, so an un-awaited fetch risks never actually completing. Found via a real
  // call where Nova's equivalent trigger silently never fired in production.
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
