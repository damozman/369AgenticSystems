import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { provisionClient } from '@/lib/onboard-client'
import { STRIPE_PRICE_ID_TO_TIER, STRIPE_CUSTOM_FIELD_KEYS, customFieldValue, decideProvisioning } from '@/lib/stripe-config'
import { escapeHtml } from '@/lib/security/sanitize'
import { resendFrom } from '@/lib/email-from'

const resend = new Resend(process.env.RESEND_API_KEY)
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'chris@369agenticsystems.com'

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

// Awaited, not fire-and-forget: this runs on Vercel, where the function can be frozen the
// moment the response is returned, and an alert about a silent failure that itself fails
// silently is worse than no alert at all. A send that throws must never mask the original
// problem, so it degrades to a log.
async function alertOwner(subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[STRIPE WEBHOOK] RESEND_API_KEY not configured — owner alert not sent:', subject)
    return
  }
  try {
    await resend.emails.send({ from: resendFrom('369 Command Center'), to: OWNER_EMAIL, subject, html })
  } catch (alertErr) {
    console.error('[STRIPE WEBHOOK] Failed to send owner alert:', subject, alertErr)
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[STRIPE WEBHOOK] STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe    = getStripeClient()
  const signature = request.headers.get('stripe-signature')
  const rawBody   = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // A completed checkout that provisions nothing must never look like success. This used to
  // return a bare 200 for anything other than 'paid', so a zero-dollar signup — what a
  // 100%-off coupon produces — was reported as a successful delivery in Stripe's dashboard
  // while no client was ever created. See lib/stripe-config.ts:decideProvisioning.
  const decision = decideProvisioning(session.payment_status)
  if (!decision.provision) {
    console.error('[STRIPE WEBHOOK] Refusing to provision session', session.id, '—', decision.reason)
    await alertOwner(
      `⚠️ Checkout completed but did NOT provision — ${session.customer_details?.email ?? session.id}`,
      `<p>A Stripe checkout completed and <strong>no client was provisioned</strong>. Nobody has an agent or a phone number as a result of this session.</p>
       <p><strong>Reason:</strong> ${escapeHtml(decision.reason)}</p>
       <p><strong>Stripe session:</strong> ${escapeHtml(session.id)}<br>
       <strong>Email:</strong> ${escapeHtml(session.customer_details?.email ?? 'unknown')}<br>
       <strong>Payment status:</strong> ${escapeHtml(String(session.payment_status))}</p>`
    )
    return NextResponse.json({ received: true, provisioned: false })
  }

  const vertical = session.client_reference_id
  const email    = session.customer_details?.email
  const ownerName = session.customer_details?.name ?? undefined
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : undefined
  // The subscription id, which is the billing-period anchor for usage metering. Present on
  // subscription-mode checkouts; absent on one-off payments, and absent is handled — a client
  // without an anchor simply is not meterable (lib/billing-period.ts:billablePeriodFor).
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : undefined

  const businessName = customFieldValue(session.custom_fields, STRIPE_CUSTOM_FIELD_KEYS.businessName)
  const clientDomain = customFieldValue(session.custom_fields, STRIPE_CUSTOM_FIELD_KEYS.clientDomain)
  const areaCode     = customFieldValue(session.custom_fields, STRIPE_CUSTOM_FIELD_KEYS.areaCode)
  // Collected via Stripe's native phone_number_collection, not a custom field —
  // custom_fields is capped at 3 per Payment Link, and this leaves room for areaCode.
  const phone        = session.customer_details?.phone ?? undefined

  if (!vertical || !email || !businessName || !clientDomain) {
    console.error('[STRIPE WEBHOOK] Missing required fields on session', session.id, {
      vertical, email, businessName, clientDomain,
    })
    return NextResponse.json({ error: 'Missing required checkout fields' }, { status: 400 })
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price'] })
  const tier = lineItems.data
    .map(item => (item.price ? STRIPE_PRICE_ID_TO_TIER[item.price.id] : undefined))
    .find(Boolean)

  if (!tier) {
    console.error('[STRIPE WEBHOOK] Could not resolve tier from line items on session', session.id)
    return NextResponse.json({ error: 'Unknown price / tier' }, { status: 400 })
  }

  try {
    await provisionClient({
      businessName,
      ownerName,
      email,
      phone,
      vertical,
      tier,
      clientDomain,
      setupPaid: true,
      preferredAreaCode: areaCode,
      stripeCustomerId,
      stripeSubscriptionId,
    })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    console.error('[STRIPE WEBHOOK] provisionClient failed:', e)

    // The checkout has already completed at this point — a provisioning failure here means
    // someone signed up for something that can't be delivered. A console log alone is easy
    // to miss, so alert immediately rather than relying on someone noticing server logs.
    await alertOwner(
      `🚨 Signup failed to provision — ${businessName} (${vertical})`,
      `<p>A Stripe checkout completed but provisioning failed. This needs manual follow-up (refund or manual provisioning).</p>
       <p><strong>Business:</strong> ${escapeHtml(businessName)}<br>
       <strong>Vertical:</strong> ${escapeHtml(vertical)}<br>
       <strong>Email:</strong> ${escapeHtml(email)}<br>
       <strong>Stripe session:</strong> ${escapeHtml(session.id)}<br>
       <strong>Payment status:</strong> ${escapeHtml(String(session.payment_status))}<br>
       <strong>Error:</strong> ${escapeHtml(errorMessage)}</p>`
    )

    return NextResponse.json({ error: 'Provisioning failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
