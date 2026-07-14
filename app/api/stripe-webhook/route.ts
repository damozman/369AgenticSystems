import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { provisionClient } from '@/lib/onboard-client'
import { STRIPE_PRICE_ID_TO_TIER, STRIPE_CUSTOM_FIELD_KEYS } from '@/lib/stripe-config'

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function customFieldValue(
  fields: Stripe.Checkout.Session.CustomField[] | null | undefined,
  key: string
): string | undefined {
  const field = fields?.find(f => f.key === key)
  return field?.type === 'text' ? field.text?.value ?? undefined : undefined
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

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  const vertical = session.client_reference_id
  const email    = session.customer_details?.email
  const ownerName = session.customer_details?.name ?? undefined

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
    })
  } catch (e) {
    console.error('[STRIPE WEBHOOK] provisionClient failed:', e)
    return NextResponse.json({ error: 'Provisioning failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
