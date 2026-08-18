import type { TierName } from '@/lib/tier-config'
import type Stripe from 'stripe'

// Public Payment Link URLs — set once Chris creates the 3 products in Stripe.
// Safe to expose client-side; these are just checkout page URLs, not secrets.
export const STRIPE_PAYMENT_LINKS: Partial<Record<TierName, string>> = {
  Starter: process.env.NEXT_PUBLIC_STRIPE_LINK_STARTER,
  Pro:     process.env.NEXT_PUBLIC_STRIPE_LINK_PRO,
  Elite:   process.env.NEXT_PUBLIC_STRIPE_LINK_ELITE,
}

// Server-side: maps a Stripe recurring Price ID (on the checkout line item) back to our tier name.
// The env vars hold the Price IDs (price_xxx), not the Payment Link URLs.
export const STRIPE_PRICE_ID_TO_TIER: Record<string, TierName> = {
  ...(process.env.STRIPE_PRICE_ID_STARTER ? { [process.env.STRIPE_PRICE_ID_STARTER]: 'Starter' as TierName } : {}),
  ...(process.env.STRIPE_PRICE_ID_PRO     ? { [process.env.STRIPE_PRICE_ID_PRO]:     'Pro'     as TierName } : {}),
  ...(process.env.STRIPE_PRICE_ID_ELITE   ? { [process.env.STRIPE_PRICE_ID_ELITE]:   'Elite'   as TierName } : {}),
}

// Custom field keys Chris must configure on each Stripe Payment Link (Stripe Dashboard →
// Payment Link → "Add custom field"). The webhook reads these exact keys back off the session.
// Stripe caps custom_fields at 3 per Payment Link — phone is collected via Stripe's native
// phone_number_collection setting instead (session.customer_details.phone), not a custom
// field, to leave room for preferred_area_code.
export const STRIPE_CUSTOM_FIELD_KEYS = {
  businessName: 'business_name',
  clientDomain: 'website_domain',
  areaCode:     'preferred_area_code',
} as const

// Shared between the webhook (provisioning) and the post-payment redirect page
// (immediate confirmation, before the webhook has necessarily landed) — both
// read the same raw Stripe session, so they need to extract fields identically.
export function customFieldValue(
  fields: Stripe.Checkout.Session.CustomField[] | null | undefined,
  key: string
): string | undefined {
  const field = fields?.find(f => f.key === key)
  return field?.type === 'text' ? field.text?.value ?? undefined : undefined
}

// ---------------------------------------------------------------------------
// Which completed checkouts provision a client.
//
// Stripe reports `payment_status: 'no_payment_required'` — NOT 'paid' — whenever the
// amount due at checkout is zero, which is exactly what a 100%-off coupon produces. A
// subscription-mode checkout in that state is still complete and still carries a real
// `subscription` id, so it must provision identically to a paid one. Gating on 'paid'
// alone meant a zero-dollar signup returned HTTP 200, showed as a successful delivery in
// Stripe's dashboard, and provisioned nothing at all.
//
// 'unpaid' is a genuinely incomplete payment and must never provision.
const PROVISIONING_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['paid', 'no_payment_required'])

export type ProvisioningDecision =
  | { provision: true }
  | { provision: false; reason: string }

export function decideProvisioning(
  paymentStatus: Stripe.Checkout.Session['payment_status'] | string | null | undefined
): ProvisioningDecision {
  if (paymentStatus && PROVISIONING_PAYMENT_STATUSES.has(paymentStatus)) {
    return { provision: true }
  }

  // Every non-provisioning outcome carries a reason, because the caller alerts with it.
  // A refusal nobody can see is the bug this function exists to prevent.
  if (paymentStatus === 'unpaid') {
    return {
      provision: false,
      reason: 'payment_status is "unpaid" — the checkout completed without payment clearing '
            + '(e.g. a delayed payment method). Nothing was provisioned. If payment later '
            + 'succeeds, Stripe sends checkout.session.async_payment_succeeded, which this '
            + 'route does not currently handle — this client needs manual provisioning.',
    }
  }

  return {
    provision: false,
    reason: `payment_status is ${JSON.stringify(paymentStatus)}, which this route does not `
          + 'recognise. Nothing was provisioned. If Stripe has added a status that should '
          + 'provision, add it to PROVISIONING_PAYMENT_STATUSES in lib/stripe-config.ts.',
  }
}
