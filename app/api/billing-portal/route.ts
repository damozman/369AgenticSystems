import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Same "most recent wins" pattern as the dashboard query — one email can
  // have more than one subscription row (second business, re-signup, etc.).
  const { data: subscriptions } = await supabaseAdmin
    .from('agent_subscriptions')
    .select('stripe_customer_id')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)

  const stripeCustomerId = subscriptions?.[0]?.stripe_customer_id

  if (!stripeCustomerId) {
    // No Stripe customer on file — likely a subscription created before this
    // field existed. Send them to the dashboard with an explanation instead
    // of a broken portal link.
    const url = new URL('/client-dashboard', request.url)
    url.searchParams.set('billing_error', 'no_customer_id')
    return NextResponse.redirect(url)
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: new URL('/client-dashboard', request.url).toString(),
    })
    return NextResponse.redirect(portalSession.url)
  } catch (e) {
    console.error('[BILLING PORTAL] Failed to create session:', e)
    const url = new URL('/client-dashboard', request.url)
    url.searchParams.set('billing_error', 'portal_failed')
    return NextResponse.redirect(url)
  }
}
