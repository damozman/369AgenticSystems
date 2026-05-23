import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

export async function POST(request: Request) {
  let body: { name?: string; email?: string; business?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name     = (body.name     ?? '').trim()
  const email    = (body.email    ?? '').trim()
  const business = (body.business ?? '').trim()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  // Save to Supabase — graceful fail so form always succeeds
  await supabaseAdmin
    .from('early_access_list')
    .insert({ name, email, business, created_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.warn('[EARLY ACCESS] Supabase insert failed:', error.message)
      else       console.log(`[EARLY ACCESS] Saved — ${email}`)
    })

  // Notify owner
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from   = process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com'

    await resend.emails.send({
      from:    `369 Command Center <${from}>`,
      to:      OWNER_EMAIL,
      subject: `🚀 New Founding Operator Application — ${business || email}`,
      html: `
        <div style="background:#0A0A0A;padding:40px 24px;font-family:monospace;">
          <div style="max-width:520px;margin:0 auto;background:#0F0F0F;border:1px solid #1E1E1E;border-radius:8px;overflow:hidden;">
            <div style="height:3px;background:#D4AF37;"></div>
            <div style="padding:28px;">
              <p style="margin:0 0 4px;font-size:10px;color:#D4AF37;text-transform:uppercase;letter-spacing:0.2em;">// NEW FOUNDING OPERATOR APPLICATION</p>
              <h2 style="margin:0 0 20px;font-size:20px;color:#FFFFFF;font-family:sans-serif;">Early Access Signup</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;font-size:11px;color:#475569;width:100px;">Name</td><td style="padding:8px 0;font-size:13px;color:#FFFFFF;">${name || '—'}</td></tr>
                <tr><td style="padding:8px 0;font-size:11px;color:#475569;">Business</td><td style="padding:8px 0;font-size:13px;color:#FFFFFF;">${business || '—'}</td></tr>
                <tr><td style="padding:8px 0;font-size:11px;color:#475569;">Email</td><td style="padding:8px 0;font-size:13px;color:#D4AF37;">${email}</td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:#334155;">Follow up when you&apos;re ready to open a deployment slot.</p>
            </div>
          </div>
        </div>`,
    }).then(({ error }) => {
      if (error) console.warn('[EARLY ACCESS] Notify email failed:', error.message)
      else       console.log(`[EARLY ACCESS] Owner notified — ${email}`)
    })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
