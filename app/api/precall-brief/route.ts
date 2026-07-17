import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    const attendees   = payload?.payload?.attendees ?? []
    const attendee    = attendees[0] ?? {}
    const bookingTime = payload?.payload?.startTime
    const title       = payload?.payload?.title ?? 'Discovery Call'

    const attendeeName  = attendee.name  || 'Unknown'
    const attendeeEmail = attendee.email || 'Unknown'
    const attendeePhone = attendee.phoneNumber || 'Not provided'

    const formattedTime = bookingTime
      ? new Date(bookingTime).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
          timeZone: 'America/Chicago',
        })
      : 'Time unknown'

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'alerts@alerts.369agenticsystems.com',
      to:      'chris@369agenticsystems.com',
      subject: `📋 Pre-Call Brief: ${attendeeName} — ${formattedTime}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0D0D0D;color:#F0F0F0;padding:32px;border-radius:12px;border:1px solid rgba(212,175,55,0.2);">
          <div style="margin-bottom:24px;">
            <p style="color:#D4AF37;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px;">369 Agentic Systems</p>
            <h1 style="color:#FFFFFF;font-size:22px;margin:0;">Pre-Call Brief</h1>
            <p style="color:#94A3B8;font-size:14px;margin:8px 0 0;">${formattedTime}</p>
          </div>

          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px;margin-bottom:20px;">
            <p style="color:#D4AF37;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 12px;">Prospect</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#64748B;font-size:12px;padding:4px 0;width:100px;">Name</td><td style="color:#F0F0F0;font-size:14px;font-weight:600;">${attendeeName}</td></tr>
              <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Email</td><td style="color:#F0F0F0;font-size:14px;">${attendeeEmail}</td></tr>
              <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Phone</td><td style="color:#F0F0F0;font-size:14px;">${attendeePhone}</td></tr>
              <tr><td style="color:#64748B;font-size:12px;padding:4px 0;">Booked</td><td style="color:#F0F0F0;font-size:14px;">${title}</td></tr>
            </table>
          </div>

          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px;margin-bottom:20px;">
            <p style="color:#D4AF37;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 12px;">Demo Checklist</p>
            <ul style="margin:0;padding-left:16px;color:#94A3B8;font-size:13px;line-height:1.8;">
              <li>Dashboard at <strong style="color:#F0F0F0;">/dashboard</strong> ready to screen share</li>
              <li>Retell demo number ready to call live</li>
              <li><strong style="color:#F0F0F0;">/roofing/pricing</strong> page open in another tab</li>
              <li>Contract PDF ready to send after call</li>
              <li>ROI calculator ready with their estimated numbers</li>
            </ul>
          </div>

          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px;">
            <p style="color:#D4AF37;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 12px;">Objection Handlers</p>
            <div style="font-size:13px;line-height:1.8;color:#94A3B8;">
              <p style="margin:0 0 8px;"><strong style="color:#F0F0F0;">"Too expensive"</strong> — "You're losing $X/month in missed calls. We're $400/mo. Most clients break even in the first week."</p>
              <p style="margin:0 0 8px;"><strong style="color:#F0F0F0;">"I want to think about it"</strong> — "What specifically would make you confident moving forward today?"</p>
              <p style="margin:0 0 8px;"><strong style="color:#F0F0F0;">"Need to talk to my partner"</strong> — "I'll send a one-pager you can both review. Can we schedule a 15-min follow-up for Thursday?"</p>
              <p style="margin:0;"><strong style="color:#F0F0F0;">"What if it doesn't work?"</strong> — "30-day results guarantee — if you don't capture at least one lead you would have missed, we refund your first month."</p>
            </div>
          </div>

          <p style="color:#475569;font-size:11px;text-align:center;margin-top:24px;">
            369 Agentic Systems · Automated pre-call brief
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PRECALL BRIEF] Error:', error)
    return NextResponse.json({ error: 'Failed to send brief' }, { status: 500 })
  }
}
