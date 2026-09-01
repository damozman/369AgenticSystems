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

/**
 * What a business DOES, as a page says it out loud.
 *
 * The hero used to set the business name as its `<h1>`, so a stranger landing cold could not tell
 * what the company sold without scrolling to Services. The fix is a headline built from what we
 * already know — noun plus primary service area, "Roofing in Fort Worth" — and this map is the
 * noun half.
 *
 * ── Why a separate map, and not `labelFor()` ──
 * `labelFor` names a vertical for an OPERATOR picking from a select: "Real Estate", "B2B Supply",
 * "Tree Service". Those are category names, and several of them are unsayable in a sentence a
 * customer reads — "Legal in Fort Worth" is not English, and "B2B Supply in Fort Worth" is a
 * filing label rather than a claim. The two lists overlap and are still different jobs, so they are
 * different functions; collapsing them would force one of the two to read badly.
 *
 * ── Why this is not stored as the vertical ──
 * `createSite` deliberately does not store the vertical (see its own note): the vertical is an
 * input, `template` and `theme` are its resolved output, and keeping both invites them to
 * disagree. The noun is a LEAF — nothing derives a template, a theme or a layout from it — so
 * storing the resolved noun carries none of that risk, and it lets an operator override a business
 * that sells itself as something the map cannot know ("Storm restoration", not "Roofing").
 */
export const VERTICAL_NOUNS: Readonly<Record<string, string>> = {
  roofing:               'Roofing',
  hvac:                  'Heating and air conditioning',
  plumbing:              'Plumbing',
  electrical:            'Electrical work',
  concrete:              'Concrete work',
  'tree-service':        'Tree service',
  'general-contracting': 'General contracting',

  'real-estate':   'Real estate',
  'property-mgmt': 'Property management',
  mortgage:        'Mortgage lending',

  legal:      'Legal counsel',
  insurance:  'Insurance',
  accounting: 'Accounting',
  consulting: 'Consulting',
  cleaning:   'Cleaning services',

  'dumpster-rental':  'Dumpster rental',
  'equipment-rental': 'Equipment rental',
  'event-rentals':    'Event and party rentals',
  hauling:            'Hauling',

  wholesale:    'Wholesale supply',
  distribution: 'Distribution',
  'b2b-supply': 'B2B supply',

  dental:       'Dental care',
  medical:      'Medical care',
  veterinary:   'Veterinary care',
  chiropractic: 'Chiropractic care',
  optometry:    'Eye care',
}

/**
 * The noun for a vertical, or `undefined` when we have none.
 *
 * Undefined rather than a guess: with no noun the hero falls back to the business name, which is
 * what it always did. Inventing "Services in Fort Worth" would be a headline that says nothing
 * while looking like it says something.
 */
export function headlineNounFor(vertical: string | null | undefined): string | undefined {
  return VERTICAL_NOUNS[normaliseVertical(vertical)]
}

/**
 * The footer line a vertical conventionally carries, as a STARTING POINT.
 *
 * ── Why this is not scoped by template, which is what the plan said ──
 * `service_clean` serves legal, insurance, accounting, consulting and cleaning. Scoping an
 * attorney-client disclaimer to that template prints it on a cleaning company's website. The need
 * follows the VERTICAL, and the vertical is not stored — so, exactly like `headline_noun`, what is
 * stored is the resolved text.
 *
 * ── These are defaults for an operator to confirm, not legal advice ──
 * They are the conventional, minimal form and assert nothing about the business. **A real firm's
 * own wording wins every time**, which is why the column is operator-editable and why nothing here
 * is applied to a site without passing through `createSite`. Most verticals are deliberately absent:
 * a roofer needs no disclaimer, though many need a licence number, which no map can know and which
 * is exactly what the override is for.
 */
export const VERTICAL_FOOTER_NOTES: Readonly<Record<string, string>> = {
  legal:
    'This website is for general information only and does not create an attorney-client '
    + 'relationship. Do not send confidential information through this form.',

  // Health practices. Deliberately narrower than the legal one: it disclaims advice and says
  // nothing about privacy, because a claim about how data is handled has to be true of the system
  // handling it, and this form's handling is the same as every other vertical's.
  dental:       'This website is for general information only and is not medical advice.',
  medical:      'This website is for general information only and is not medical advice.',
  chiropractic: 'This website is for general information only and is not medical advice.',
  optometry:    'This website is for general information only and is not medical advice.',
  veterinary:   'This website is for general information only and is not veterinary advice.',
}

/** The default footer note for a vertical, or `undefined` when it conventionally needs none. */
export function footerNoteFor(vertical: string | null | undefined): string | undefined {
  return VERTICAL_FOOTER_NOTES[normaliseVertical(vertical)]
}
