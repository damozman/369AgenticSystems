import { dentalConfig } from './dental'
import { roofingConfig } from './roofing'
import { hvacConfig } from './hvac'
import { plumbingConfig } from './plumbing'
import { legalConfig } from './legal'
import { realEstateConfig } from './real-estate'
import { insuranceConfig } from './insurance'
import { saasConfig } from './saas'
import { wholesaleConfig } from './wholesale'

export type VerticalConfig = {
  vertical: string
  systemPrompt: string
  subjectPrefix: string
}

const genericConfig: VerticalConfig = {
  vertical: 'general',

  systemPrompt: `You are an expert email assistant for a service business. You draft professional, direct email responses to prospective and existing customers on behalf of the business.

TONE: Professional, warm, never robotic.
LENGTH: 2-4 short paragraphs. Be direct.
GOAL: Answer their question clearly, set correct expectations, and include one clear next step.

ALWAYS:
- Open with a warm acknowledgment of their message.
- Address their specific question or concern directly — don't be vague.
- End with a clear next step (schedule a call, expect a follow-up, etc.).
- Sign off with the company name.

NEVER:
- Make specific pricing, coverage, or timeline commitments you can't verify.
- Write more than 4 paragraphs.`,

  subjectPrefix: 'Re:',
}

const REGISTRY: Record<string, VerticalConfig> = {
  dental:        dentalConfig,
  roofing:       roofingConfig,
  hvac:          hvacConfig,
  plumbing:      plumbingConfig,
  legal:         legalConfig,
  'real-estate': realEstateConfig,
  'real estate': realEstateConfig,
  realestate:    realEstateConfig,
  insurance:     insuranceConfig,
  saas:          saasConfig,
  wholesale:     wholesaleConfig,
}

const VERTICAL_KEYS = Object.keys(REGISTRY)

/**
 * The canonical vertical keys, in this project's own spelling.
 *
 * Derived from each config's self-declared `vertical` rather than from `REGISTRY`, whose keys
 * deliberately include loose aliases ('real estate', 'realestate') for input tolerance. Those are
 * things we ACCEPT, not things we are; treating them as canon is how a third spelling gets born.
 *
 * Exported so Lead Engine can build its own vertical list on top of this one instead of
 * redeclaring it. That matters more than it looks: `real-estate` was already filed under three
 * different spellings once in this repo, and nothing looked wrong while it happened.
 */
export const CANONICAL_VERTICALS: readonly string[] = [
  dentalConfig, roofingConfig, hvacConfig, plumbingConfig, legalConfig,
  realEstateConfig, insuranceConfig, saasConfig, wholesaleConfig,
].map(c => c.vertical)

/**
 * Resolves a loosely-formatted industry string (e.g. from a Gumloop-echoed
 * field, which may be "Roofing", "roofing contractor", "369AS_ROOFING_INTAKE",
 * etc.) to the matching vertical config. Falls back to a generic config —
 * never silently defaults to a specific vertical's voice.
 */
export function getVerticalConfig(industryRaw: string | null | undefined): VerticalConfig {
  if (!industryRaw) return genericConfig

  const normalized = industryRaw.toLowerCase().trim()

  const exact = REGISTRY[normalized]
  if (exact) return exact

  const match = VERTICAL_KEYS.find(key => normalized.includes(key))
  if (match) return REGISTRY[match]

  return genericConfig
}
