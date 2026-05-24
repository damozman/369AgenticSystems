import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Resend signs webhook payloads — verify the signature to reject spoofed requests.
// Set RESEND_WEBHOOK_SECRET in Vercel env vars (from Resend dashboard → Webhooks → Signing Secret).
async function verifySignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // skip verification if secret not configured yet

  const svixId        = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) return false

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`
  const key    = await crypto.subtle.importKey(
    'raw',
    Buffer.from(secret.replace(/^whsec_/, ''), 'base64'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, Buffer.from(toSign))
  const computed = `v1,${Buffer.from(sigBytes).toString('base64')}`

  // svix-signature may contain multiple space-separated signatures
  return svixSignature.split(' ').some(s => s === computed)
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  const valid = await verifySignature(request, rawBody)
  if (!valid) {
    console.warn('[RESEND WEBHOOK] ✗ Invalid signature — rejected')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type       = event.type as string | undefined
  const data       = (event.data ?? {}) as Record<string, unknown>
  const email_id   = data.email_id as string | undefined
  const to         = (data.to as string[] | undefined)?.[0]
  const subject    = data.subject as string | undefined
  const created_at = (data.created_at as string | undefined) ?? new Date().toISOString()

  console.log(`[RESEND WEBHOOK] ▶ ${type} | to: ${to} | subject: ${subject}`)

  // Store the signal in a new email_events table so the dashboard can surface it.
  // Table DDL (run once in Supabase SQL editor):
  //   CREATE TABLE email_events (
  //     id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  //     created_at timestamptz DEFAULT now(),
  //     event_type text NOT NULL,
  //     email_id   text,
  //     to_email   text,
  //     subject    text
  //   );
  //   ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
  //   CREATE POLICY "service_role_only" ON email_events USING (false);
  if (type) {
    const { error } = await supabaseAdmin.from('email_events').insert({
      event_type: type,
      email_id,
      to_email: to,
      subject,
      created_at,
    })
    if (error) {
      // Table may not exist yet — log but don't fail (200 keeps Resend from retrying)
      console.warn('[RESEND WEBHOOK] ⚠ DB insert skipped:', error.message)
    } else {
      console.log(`[RESEND WEBHOOK] ✓ ${type} stored`)
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
