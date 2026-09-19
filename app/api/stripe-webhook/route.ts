import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { provisionClient } from '@/lib/onboard-client'
import { STRIPE_PRICE_ID_TO_TIER, STRIPE_CUSTOM_FIELD_KEYS, customFieldValue, decideProvisioning, tierFromSubscriptionItems } from '@/lib/stripe-config'
import { applyTierChange } from '@/lib/tier-change'
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

/**
 * A plan change — the only way an existing client's tier ever moves.
 *
 * Stripe's billing portal changes a subscription in place; it never creates a checkout session, so
 * before this existed an upgrade reached nothing. The client was billed the new price while our
 * database kept the old tier, and Elite's Live Call Transfer — attached only at purchase time —
 * was never attached at all.
 *
 * `customer.subscription.updated` also fires for renewals, payment-method changes and cancel-at-
 * period-end toggles. Rather than guess from `previous_attributes`, this resolves the tier the
 * subscription is on *now* and converges to it, which is idempotent under Stripe's retries.
 */
async function handleSubscriptionUpdated(event: Stripe.Event, stripe: Stripe): Promise<NextResponse> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : undefined

  const resolution = tierFromSubscriptionItems(subscription.items?.data)
  if (!resolution.tier) {
    // Never guess a tier. Defaulting here would silently re-grade a paying client — including
    // stripping Elite from someone who still pays for it.
    console.error('[STRIPE WEBHOOK] Could not resolve tier for subscription', subscription.id, '—', resolution.reason)
    await alertOwner(
      `⚠️ Subscription changed but the tier could not be resolved — ${subscription.id}`,
      `<p>A Stripe subscription was updated and <strong>no tier change was applied</strong>. If this was an upgrade, the client is being billed for something they have not been given.</p>
       <p><strong>Reason:</strong> ${escapeHtml(resolution.reason)}</p>
       <p><strong>Subscription:</strong> ${escapeHtml(subscription.id)}<br>
       <strong>Customer:</strong> ${escapeHtml(customerId ?? 'unknown')}</p>`
    )
    return NextResponse.json({ received: true, applied: false })
  }

  // Only read back the customer when we might need a number we never stored. Every signup before
  // 2026-09-18 discarded the phone for non-Elite tiers, and those are exactly the upgraders.
  let fallbackPhone: string | null = null
  if (resolution.tier === 'Elite' && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!customer.deleted) fallbackPhone = customer.phone ?? null
    } catch (e) {
      console.warn('[STRIPE WEBHOOK] Could not read the Stripe customer for a phone fallback:', e)
    }
  }

  const result = await applyTierChange({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    tier: resolution.tier,
    fallbackPhone,
  })

  // A failed tier write is the one case worth a non-2xx: the tier drives billing and feature
  // gating, and Stripe's retry is the cheapest way to converge. Everything else has already
  // written the tier, so retrying would not improve it — those alert and return 200.
  if (!result.clientDomain || (result.needsAttention && !result.transfer)) {
    await alertOwner(
      `🚨 Subscription changed but was NOT applied — ${subscription.id}`,
      `<p>A Stripe subscription moved to <strong>${escapeHtml(resolution.tier)}</strong> and the change could not be applied.</p>
       <p><strong>Reason:</strong> ${escapeHtml(result.reason)}</p>
       <p><strong>Subscription:</strong> ${escapeHtml(subscription.id)}<br>
       <strong>Customer:</strong> ${escapeHtml(customerId ?? 'unknown')}</p>`
    )
    return NextResponse.json({ error: 'Tier change not applied', reason: result.reason }, { status: 500 })
  }

  if (result.needsAttention) {
    // The tier is correct; the agent is not. Most often: Elite with no forwarding number on file,
    // so there is nothing to transfer to. Silence here would be a tier that promises live transfer
    // and an agent that cannot do it.
    await alertOwner(
      `⚠️ ${result.clientDomain} is now ${resolution.tier}, but Live Call Transfer is not active`,
      `<p>The tier change was applied. <strong>The transfer tool was not.</strong></p>
       <p><strong>Reason:</strong> ${escapeHtml(result.transfer?.reason ?? result.reason)}</p>
       <p><strong>Client:</strong> ${escapeHtml(result.clientDomain)}<br>
       <strong>Tier:</strong> ${escapeHtml(result.previousTier ?? 'unset')} → ${escapeHtml(result.newTier)}</p>
       <p>To fix: put the client's forwarding number in <code>agent_subscriptions.owner_phone</code>, then run
       <code>node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/retell/sync-transfer-tool.mjs ${escapeHtml(result.clientDomain)} --apply</code>.</p>`
    )
  }

  console.log(`[STRIPE WEBHOOK] Subscription ${subscription.id}: ${result.reason}`)
  return NextResponse.json({
    received: true,
    applied: true,
    tierChanged: result.tierChanged,
    transfer: result.transfer?.action ?? null,
  })
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

  if (event.type === 'customer.subscription.updated') {
    return handleSubscriptionUpdated(event, stripe)
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
