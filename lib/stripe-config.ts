import type { TierName } from '@/lib/tier-config'

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
