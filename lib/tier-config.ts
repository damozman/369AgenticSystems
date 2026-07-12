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
    description: 'Your AI receptionist is live in 24 hours. Answer every call, capture every lead, track ROI monthly.',
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
      { label: 'Premium Voice Quality (indistinguishable from human)', retellFeature: true, badge: 'Premium' },
      { label: 'Custom Business Intelligence', retellFeature: true, retailValue: 49, badge: 'Custom BI' },
      { label: 'Call recording + searchable transcript archive (coming soon)' },
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

export const SETUP_FEE = 1500

export const PRICE_BY_TIER: Record<TierName, number> = {
  Starter: 400,
  Pro:     600,
  Elite:   750,
}
