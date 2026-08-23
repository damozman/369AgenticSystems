/**
 * The verticals a Lead Engine site can be created for.
 *
 * Vertical is an INPUT to `createSite()`, never stored — `template` and `theme` are the resolved
 * output. See the design brief §2: storing the input alongside the output invites the two-writer
 * bug, because the two can then disagree and nothing says which is right.
 *
 * ── Why this file derives rather than declares ──
 * The design brief writes its keys with underscores (`real_estate`, `event_rentals`). The rest of
 * this repo writes them with hyphens — `agent_subscriptions.vertical`, `lib/verticals/`, and every
 * row already in production. Chris's call, 2026-08-23: hyphens win everywhere, and Lead Engine
 * builds its list ON TOP of `CANONICAL_VERTICALS` so a third spelling is structurally impossible
 * rather than merely discouraged.
 *
 * That is not a hypothetical. `369AS_REALESTATE_INTAKE` and `369AS_REAL_ESTATE_INTAKE` coexisted
 * in this codebase for months, every real-estate lead was filed under a third spelling, and
 * nothing errored and nothing looked wrong.
 */

import { CANONICAL_VERTICALS } from '@/lib/verticals/index'

/**
 * Verticals Lead Engine serves that the voice product does not.
 *
 * Lead Engine sells to any local service business; the voice product has nine verticals with
 * hand-written agent prompts behind them. These are the difference. Anything added here must be a
 * local business a mini-site genuinely suits — and must appear in `VERTICAL_MAP` below, which the
 * tests enforce in both directions.
 */
export const LEAD_ENGINE_ONLY_VERTICALS = [
  'electrical', 'concrete', 'tree-service', 'general-contracting',
  'property-mgmt', 'mortgage',
  'accounting', 'consulting', 'cleaning',
  'dumpster-rental', 'equipment-rental', 'event-rentals', 'hauling',
  'distribution', 'b2b-supply',
  'medical', 'veterinary', 'chiropractic', 'optometry',
] as const

/**
 * The spelling rule, enforced rather than trusted.
 *
 * Lowercase, hyphen-separated, no underscores. This is what rejects the design brief's
 * `real_estate` at the boundary instead of letting it reach a customer's URL or a database row.
 *
 * Digits are allowed, which the originally specified `/^[a-z]+(-[a-z]+)*$/` did not: it rejects
 * `b2b-supply`, a key from the brief's own mapping. The intent is "lowercase, hyphen-separated, no
 * underscores", and a digit violates none of that.
 */
export const VERTICAL_KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Every vertical Lead Engine offers.
 *
 * Note the direction: canonical verticals are not all Lead Engine verticals. `saas` is canonical
 * and deliberately absent — Lead Engine is for local service businesses, and a SaaS company is not
 * one. A key must be canonical OR Lead-Engine-only; it need not be both, and canon need not be
 * exhausted.
 */
export const LEAD_ENGINE_VERTICALS: readonly string[] = [
  ...CANONICAL_VERTICALS.filter(v => v !== 'saas'),
  ...LEAD_ENGINE_ONLY_VERTICALS,
]

/** Human-readable labels for the admin select. Absent means "title-case the key". */
const LABEL_OVERRIDES: Record<string, string> = {
  'hvac':                'HVAC',
  'real-estate':         'Real Estate',
  'property-mgmt':       'Property Management',
  'b2b-supply':          'B2B Supply',
  'event-rentals':       'Event & Party Rentals',
  'general-contracting': 'General Contracting',
  'tree-service':        'Tree Service',
}

export function labelFor(vertical: string): string {
  if (LABEL_OVERRIDES[vertical]) return LABEL_OVERRIDES[vertical]
  return vertical.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export interface VerticalOption { value: string; label: string }
export interface VerticalOptionGroup { group: string; options: VerticalOption[] }

/**
 * The admin create-site select, grouped.
 *
 * Grouped because a flat list of twenty-six is a scroll rather than a choice, and the groups line
 * up with the theme families so an operator can see why two trades share a look.
 *
 * There is deliberately **no blank option and no "Other"**. An unmapped vertical resolves to the
 * default pair, so offering "Other" is offering "make it look like a law firm" without saying so.
 * Requiring a real choice is what stops every site defaulting to Counsel.
 */
export const VERTICAL_OPTION_GROUPS: readonly VerticalOptionGroup[] = [
  { group: 'Trades',                 options: ['roofing', 'hvac', 'plumbing', 'electrical', 'concrete', 'tree-service', 'general-contracting'] },
  { group: 'Property',               options: ['real-estate', 'property-mgmt', 'mortgage'] },
  { group: 'Professional services',  options: ['legal', 'insurance', 'accounting', 'consulting', 'cleaning'] },
  { group: 'Rentals & hauling',      options: ['dumpster-rental', 'equipment-rental', 'event-rentals', 'hauling'] },
  { group: 'Supply & distribution',  options: ['wholesale', 'distribution', 'b2b-supply'] },
  { group: 'Health practices',       options: ['dental', 'medical', 'veterinary', 'chiropractic', 'optometry'] },
].map(g => ({ group: g.group, options: g.options.map(value => ({ value, label: labelFor(value) })) }))

/** Every option an operator can actually pick, flattened. */
export const ALL_VERTICAL_OPTIONS: readonly VerticalOption[] =
  VERTICAL_OPTION_GROUPS.flatMap(g => g.options)

/**
 * Normalises the design brief's underscore spelling to ours.
 *
 * Tolerating the alias costs one line and means a caller who copied a key out of
 * `LEAD-ENGINE-DESIGN-BRIEF.md` resolves correctly instead of silently landing on the fallback —
 * the same shape as `getVerticalConfig` accepting both real-estate spellings. Tolerance on input,
 * one spelling on output.
 */
export function normaliseVertical(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-')
}
