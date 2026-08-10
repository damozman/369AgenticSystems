// Single source of truth for tier structure, pricing, and premium add-ons.

export type TierName = 'Starter' | 'Pro' | 'Elite'

export interface TierFeature {
  label:         string
  isSection?:    boolean  // true for "Everything in [prev tier], plus:" separators
  retellFeature?: boolean // Retell AI platform feature — has a retail price if purchased separately
  retailValue?:  number  // monthly retail price on Retell if purchased à la carte
  badge?:        string  // short brand name, e.g. 'Crystal Clear'
}

export interface Tier {
  name:        TierName
  price:       number
  featured?:   boolean
  description: string
  agents:      string[]
  features:    TierFeature[]
  retellConfig: {
    voiceQuality:  'standard' | 'enhanced' | 'premium'
    biEnabled:     boolean
    callRecording: boolean
  }
}

export const TIERS: Tier[] = [
  {
    name:        'Starter',
    price:       400,
    description: 'Your AI receptionist is live in minutes. Answer every call, capture every lead, track ROI monthly.',
    agents:      ['receptionist', 'dashboard'],
    features: [
      { label: '24/7 AI Receptionist (unique phone number)' },
      { label: 'Crystal Clear Call Quality', retellFeature: true, retailValue: 25, badge: 'Crystal Clear' },
      { label: 'Lead capture + real-time dashboard' },
      { label: 'Business context from onboarding questionnaire' },
      { label: 'Email booking confirmations' },
      { label: 'Daily email summaries + monthly ROI report' },
      { label: '24/7 chat support' },
    ],
    retellConfig: {
      voiceQuality:  'standard',
      biEnabled:     false,
      callRecording: true,
    },
  },
  {
    name:        'Pro',
    price:       600,
    featured:    true,
    description: 'Receptionist + automated follow-up for ALL 9 industries. Vertical-specific messaging built in.',
    agents:      ['receptionist', 'followup', 'dashboard'],
    features: [
      { label: 'Everything in Starter, plus:', isSection: true },
      { label: 'Automated 3-step follow-up sequence (all 9 verticals)' },
      { label: 'Vertical-specific messaging (legal deadlines, real estate timing, etc.)' },
      { label: 'Enhanced Voice Quality', retellFeature: true, badge: 'Enhanced' },
      { label: 'Priority email support' },
    ],
    retellConfig: {
      voiceQuality:  'enhanced',
      biEnabled:     false,
      callRecording: true,
    },
  },
  {
    name:        'Elite',
    price:       750,
    description: 'Full AI team: receptionist + follow-up + live transfers. Seamless handoff to your team when needed.',
    agents:      ['receptionist', 'followup', 'dashboard'],
    features: [
      { label: 'Everything in Pro, plus:', isSection: true },
      { label: 'Live Call Transfer (routes urgent calls to your phone in real time)' },
      { label: 'Premium Voice Quality — our most natural-sounding voice tier', retellFeature: true, badge: 'Premium' },
      { label: 'Custom Business Intelligence', retellFeature: true, retailValue: 49, badge: 'Custom BI' },
      { label: 'Call recording + searchable transcript archive' },
      { label: 'Priority onboarding & dedicated support' },
    ],
    retellConfig: {
      voiceQuality:  'premium',
      biEnabled:     true,
      callRecording: true,
    },
  },
]

export interface PremiumAddon {
  id:           string
  label:        string
  price:        number
  description:  string
  availableFor: TierName[]
}

export const PREMIUM_ADDONS: PremiumAddon[] = [
  {
    id:          'hot_transfer',
    label:       'Live Call Transfer',
    price:       49,
    description: 'Instantly routes urgent callers to your team in real time — zero hold time.',
    availableFor: ['Starter', 'Pro', 'Elite'],
  },
  {
    id:          'branded_caller',
    label:       'Branded Caller ID',
    price:       29,
    description: 'Your business name appears on every outbound call and callback.',
    availableFor: ['Starter', 'Pro', 'Elite'],
  },
  {
    id:          'spanish_support',
    label:       'Spanish Language Support',
    price:       79,
    description: 'Full bilingual receptionist — seamlessly handles English and Spanish callers.',
    availableFor: ['Starter', 'Pro', 'Elite'],
  },
  {
    id:          'custom_voice',
    label:       'Custom Voice & Persona',
    price:       99,
    description: 'Clone your voice or design a custom AI persona that matches your brand.',
    availableFor: ['Pro', 'Elite'],
  },
  {
    id:          'hipaa_pack',
    label:       'HIPAA Compliance Pack',
    price:       99,
    description: 'BAA, encrypted transcripts, and audit trail — required for healthcare and dental.',
    availableFor: ['Pro', 'Elite'],
  },
]

// Returns all non-section features for a tier (used for metrics, email, and dashboards)
export function getTierFeatures(name: TierName): TierFeature[] {
  const tier = TIERS.find(t => t.name === name)
  if (!tier) return []
  return tier.features.filter(f => !f.isSection)
}

// Returns only the Retell-platform features bundled into a tier
export function getTierRetellFeatures(name: TierName): TierFeature[] {
  return getTierFeatures(name).filter(f => f.retellFeature)
}

export function getTier(name: TierName): Tier | undefined {
  return TIERS.find(t => t.name === name)
}

export function tierHasFeature(tierName: TierName, badge: string): boolean {
  return getTierFeatures(tierName).some(f => f.badge === badge)
}

// Removed from checkout 2026-07-17 (Chris's call — the fee was priced against manual
// per-client provisioning labor that no longer exists since automated Stripe→Retell
// provisioning shipped). Kept as an exported constant at 0, not deleted, since
// VerticalROICalculator.tsx's math already adds it in rather than assuming it's zero —
// changing the value here is correct, removing the export would require touching that
// math too for no benefit.
export const SETUP_FEE = 0

export const PRICE_BY_TIER: Record<TierName, number> = {
  Starter: 400,
  Pro:     600,
  Elite:   750,
}

/**
 * Included call minutes per month, and the overage rate beyond them.
 *
 * ⚠️ **These are not advertised anywhere yet, and must not be until billing is live.**
 *
 * Flat pricing makes the heaviest user the worst-margin user with no lever, which is what these
 * fix. But nothing bills on them today: /api/cron/usage-rollup records what a period *would* have
 * cost as a `'shadow'` row and charges nothing. Adding "300 included minutes" or
 * "$0.35/min overage" to the `features` lists above publishes a promise the system cannot yet
 * measure or honour — and this exact file was the site of that mistake once already
 * (pricing-tier overclaim, 2026-07-11). The copy ships in the same commit as the billing, and not
 * one release earlier.
 *
 * Allowances are sized on ~2 minutes per call over 30 days: 300 ≈ 10 calls/day, 600 ≈ 20,
 * 1,000 ≈ 33.
 */
export const TIER_MINUTES: Record<TierName, number> = {
  Starter: 300,
  Pro:     600,
  Elite:   1000,
}

/**
 * Overage in **integer cents per minute** — deliberately not dollars.
 *
 * `0.35 * 3` is `1.0499999999999998` in floating point. Money that passes through a float is
 * money that eventually bills a cent wrong, and it will be wrong in our favour about half the
 * time, which is the half that costs a customer.
 *
 * Rates descend by tier so upgrading is cheaper than overspending, and the floor covers Retell's
 * ~15–25¢/min plus the LLM plus margin.
 */
export const OVERAGE_RATE_CENTS: Record<TierName, number> = {
  Starter: 35,
  Pro:     30,
  Elite:   25,
}
