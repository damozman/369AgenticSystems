/**
 * The design layer: vertical → template + theme, and validation of customer brand input.
 *
 * Pure. No I/O, no React, no DOM. Same shape as `slug.ts` and `limits.ts`, for the same reason —
 * these are the decisions that determine what a paying customer's website looks like, and they
 * should be readable and testable without rendering anything.
 *
 * The design reference is `.claude/skills/site-design-system/SKILL.md`. Token values below are
 * transcribed from its six kits; the rules behind them live there and are deliberately not
 * duplicated here. If a value here disagrees with the SKILL, the SKILL is right.
 *
 * A site is `template × theme × brand`:
 *   template — section order, chosen by the customer's BUYING QUESTION, so roofing and plumbing share one
 *   theme    — palette, type, radius, motion
 *   brand    — the customer's own accent, display face and logo, applied WITHIN a theme
 *
 * None of it lives in `content` jsonb. That separation is what lets an operator re-theme a live
 * site with no content diff, and stops a re-submitted questionnaire from changing how a site looks.
 */

import { normaliseVertical } from '@/lib/lead-engine/verticals'

export type Template =
  | 'trade_classic' | 'service_clean' | 'showcase_grid'
  | 'practice' | 'supply'

export type Theme =
  | 'ironclad' | 'counsel' | 'threshold'
  | 'ledger' | 'yard' | 'clinic'

export type AccentMode = 'text_safe' | 'surface_only' | 'derived'

export type PaperShade = 'light' | 'default' | 'warm'
export type LogoTreatment = 'mark' | 'wordmark' | 'lockup'

export interface Brand {
  accent?: string
  accent_derived?: string
  accent_mode?: AccentMode
  display_font?: string
  paper_shade?: PaperShade
  logo_url?: string
  logo_treatment?: LogoTreatment
}

export const TEMPLATES: readonly Template[] =
  ['trade_classic', 'service_clean', 'showcase_grid', 'practice', 'supply']

export const THEMES: readonly Theme[] =
  ['ironclad', 'counsel', 'threshold', 'ledger', 'yard', 'clinic']

/**
 * The safest pair, not the commonest one.
 *
 * Service Clean carries a page with no photos at all, and Counsel is the most conservative kit —
 * so a row created before anyone knows the vertical renders acceptably rather than broken.
 */
export const DEFAULT_TEMPLATE: Template = 'service_clean'
export const DEFAULT_THEME: Theme = 'counsel'

// ── Vertical → template + theme ──────────────────────────────────────────────

export interface TemplateThemePair { template: Template; theme: Theme }

/**
 * Exported so tests can assert that every option an operator can pick is a REAL key here, rather
 * than one that silently falls through to the default pair. Distinguishing "explicitly mapped to
 * service_clean + counsel" from "fell through to it" is impossible from `resolveForVertical`'s
 * return value alone, because they are the same value.
 *
 * Keys are hyphenated, matching `lib/verticals/` and every row already in production. The design
 * brief writes them with underscores; `normaliseVertical` accepts that spelling on the way in.
 */
export const VERTICAL_MAP: Readonly<Record<string, TemplateThemePair>> = {
  // Trades — "Can I trust you with my property?"
  'roofing':             { template: 'trade_classic', theme: 'ironclad' },
  'hvac':                { template: 'trade_classic', theme: 'ironclad' },
  'plumbing':            { template: 'trade_classic', theme: 'ironclad' },
  'electrical':          { template: 'trade_classic', theme: 'ironclad' },
  'concrete':            { template: 'trade_classic', theme: 'ironclad' },
  'tree-service':        { template: 'trade_classic', theme: 'ironclad' },
  'general-contracting': { template: 'trade_classic', theme: 'ironclad' },

  // Property — same buying question, different identity.
  'real-estate':   { template: 'trade_classic', theme: 'threshold' },
  'property-mgmt': { template: 'trade_classic', theme: 'threshold' },
  'mortgage':      { template: 'trade_classic', theme: 'threshold' },

  // Professional services — "Are you the right professional for my situation?"
  'legal':      { template: 'service_clean', theme: 'counsel' },
  'insurance':  { template: 'service_clean', theme: 'counsel' },
  'accounting': { template: 'service_clean', theme: 'counsel' },
  'consulting': { template: 'service_clean', theme: 'counsel' },
  'cleaning':   { template: 'service_clean', theme: 'counsel' },

  // Rentals and hauling — "What have you got, and is it available?"
  'dumpster-rental':  { template: 'showcase_grid', theme: 'yard' },
  'equipment-rental': { template: 'showcase_grid', theme: 'yard' },
  'event-rentals':    { template: 'showcase_grid', theme: 'yard' },
  'hauling':          { template: 'showcase_grid', theme: 'yard' },

  // Supply — "Can you supply what I need, at my volume, on my timeline?"
  'wholesale':    { template: 'supply', theme: 'ledger' },
  'distribution': { template: 'supply', theme: 'ledger' },
  'b2b-supply':   { template: 'supply', theme: 'ledger' },

  // Health practices — "Can I get in, and do you take my insurance?"
  'dental':       { template: 'practice', theme: 'clinic' },
  'medical':      { template: 'practice', theme: 'clinic' },
  'veterinary':   { template: 'practice', theme: 'clinic' },
  'chiropractic': { template: 'practice', theme: 'clinic' },
  'optometry':    { template: 'practice', theme: 'clinic' },
}

/**
 * The five verticals that map to the default pair ON PURPOSE.
 *
 * If a test fails because you added a vertical: confirm that landing on the default pair
 * (`service_clean` + `counsel`) is deliberate for it, and if so add it to this list. A future
 * failure here should read as a prompt, not a puzzle.
 *
 * The reason this list exists at all: an option that resolves to the default pair is
 * indistinguishable from an option nobody remembered to map. Naming the intended ones makes the
 * unintended ones visible.
 */
export const INTENTIONAL_DEFAULT_PAIR_VERTICALS: readonly string[] =
  ['legal', 'insurance', 'accounting', 'consulting', 'cleaning']

/** Never throws. An unknown vertical gets the safe pair, not an exception on a customer's page. */
export function resolveForVertical(vertical: string | null | undefined): TemplateThemePair {
  const key = normaliseVertical(vertical)
  return VERTICAL_MAP[key] ?? { template: DEFAULT_TEMPLATE, theme: DEFAULT_THEME }
}

/**
 * The layout actually rendered, given the STATED template and how many photos exist.
 *
 * A site with no usable photos renders Service Clean's structure whatever it says, because
 * Trade Classic opens on a photo and Showcase Grid leads with a grid — both render empty frames
 * with nothing to put in them, and an empty frame is worse than a different layout.
 *
 * **The theme does not change.** A roofer with no photos gets Service Clean's structure in
 * Ironclad's identity, and still reads as a roofer.
 *
 * The result is never written back to the `template` column: that column holds stated intent, and
 * a photo uploaded next month must restore the intended layout with no admin action.
 */
export function effectiveTemplate(template: Template | string | null | undefined, photoCount: number): Template {
  if (!(photoCount > 0)) return 'service_clean'
  return TEMPLATES.includes(template as Template) ? (template as Template) : DEFAULT_TEMPLATE
}

// ── Colour maths ─────────────────────────────────────────────────────────────
// Implemented inline. Roughly sixty lines is not worth a dependency, and a colour library is a
// supply-chain surface for something this self-contained.

function parseHex(hex: unknown): [number, number, number] | null {
  if (typeof hex !== 'string') return null
  const s = hex.trim().replace(/^#/, '')
  const full = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ]
}

function toHex(rgb: [number, number, number]): string {
  const part = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`.toUpperCase()
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const toSrgb   = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** WCAG 2.1 relative luminance. */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours, 1..21. */
export function contrastRatio(aHex: string, bHex: string): number {
  const a = parseHex(aHex), b = parseHex(bHex)
  if (!a || !b) return 1
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Björn Ottosson's OKLab. Perceptually uniform, so reducing L darkens a colour without the hue
// drift that the same operation in HSL produces — which is the whole reason for using it here.
function rgbToOklch(rgb: [number, number, number]): { L: number; C: number; H: number } {
  const [r, g, b] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  return {
    L,
    C: Math.sqrt(A * A + B * B),
    H: (Math.atan2(B, A) * 180) / Math.PI,
  }
}

function oklchToRgb(L: number, C: number, Hdeg: number): [number, number, number] {
  const h = (Hdeg * Math.PI) / 180
  const A = C * Math.cos(h)
  const B = C * Math.sin(h)

  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3)

  return [
    toSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ]
}

/**
 * OKLCH → sRGB, reducing CHROMA rather than clipping channels when the colour falls outside the
 * sRGB gamut.
 *
 * This is what actually preserves hue, and it was found by a failing test rather than by reasoning.
 * A saturated yellow darkened at constant chroma leaves the gamut immediately; clamping the
 * resulting channels into [0,1] shifts the hue — #FFE500 came back 5.9 degrees off, over the 5
 * degree budget, and a customer would not recognise their own colour. Backing chroma off keeps
 * hue exact, because only L and C move and hue is the angle.
 */
function oklchToRgbInGamut(L: number, C: number, Hdeg: number): [number, number, number] {
  let chroma = C
  for (let i = 0; i < 64; i++) {
    const rgb = oklchToRgb(L, chroma, Hdeg)
    if (rgb.every(c => c >= -0.0005 && c <= 1.0005)) return rgb
    chroma *= 0.95
  }
  return oklchToRgb(L, 0, Hdeg)
}

// ── Theme kits ───────────────────────────────────────────────────────────────

interface Kit {
  ink: string
  structure: string
  paper: Record<PaperShade, string>
  accent: string
  edge: string
  fontDisplay: string
  fontBody: string
  fontUtility: string
  displayWeight: string
  displayTracking: string
  bodyLine: string
  utilityWeight: string
  utilityTracking: string
  utilityTransform: string
  radiusButton: string
  radiusCard: string
  radiusImage: string
  shadowCard: string
  /** Display face plus two alternates. Index 0 is the default. Never free text. */
  fonts: string[]
}

const KITS: Record<Theme, Kit> = {
  ironclad: {
    ink: '#15181D', structure: '#2C3A47', accent: '#C8542B', edge: '#D6D8D2',
    paper: { light: '#F8F9F6', default: '#F2F3F0', warm: '#F2F1EC' },
    fontDisplay: 'Archivo Black', fontBody: 'Archivo', fontUtility: 'Archivo',
    displayWeight: '800', displayTracking: '-0.02em', bodyLine: '1.6',
    utilityWeight: '600', utilityTracking: '0.08em', utilityTransform: 'uppercase',
    radiusButton: '2px', radiusCard: '4px', radiusImage: '0px', shadowCard: 'none',
    fonts: ['Archivo Black', 'Oswald', 'Archivo'],
  },
  counsel: {
    ink: '#1A1A17', structure: '#3D4A3F', accent: '#7A5C2E', edge: '#E0DFD9',
    paper: { light: '#FFFFFF', default: '#FAFAF8', warm: '#F8F6F0' },
    fontDisplay: 'Newsreader', fontBody: 'Public Sans', fontUtility: 'Public Sans',
    displayWeight: '500', displayTracking: '-0.015em', bodyLine: '1.7',
    utilityWeight: '500', utilityTracking: '0.1em', utilityTransform: 'uppercase',
    radiusButton: '0px', radiusCard: '0px', radiusImage: '0px', shadowCard: 'none',
    fonts: ['Newsreader', 'Source Serif 4', 'Libre Baskerville'],
  },
  threshold: {
    ink: '#14171A', structure: '#37474A', accent: '#8C6A4A', edge: '#E8E8E6',
    paper: { light: '#FFFFFF', default: '#FFFFFF', warm: '#FAF8F5' },
    fontDisplay: 'Instrument Serif', fontBody: 'DM Sans', fontUtility: 'DM Sans',
    displayWeight: '400', displayTracking: '-0.01em', bodyLine: '1.65',
    utilityWeight: '500', utilityTracking: '0.09em', utilityTransform: 'uppercase',
    // The one soft element in the kit — deliberate, per the SKILL.
    radiusButton: '999px', radiusCard: '0px', radiusImage: '0px', shadowCard: 'none',
    fonts: ['Instrument Serif', 'Lora', 'Cormorant'],
  },
  ledger: {
    ink: '#101418', structure: '#1E2A38', accent: '#1F6F8B', edge: '#D3D7DB',
    paper: { light: '#FBFBFC', default: '#F5F6F7', warm: '#F5F4F1' },
    fontDisplay: 'IBM Plex Sans', fontBody: 'IBM Plex Sans', fontUtility: 'IBM Plex Mono',
    displayWeight: '600', displayTracking: '-0.02em', bodyLine: '1.6',
    utilityWeight: '500', utilityTracking: '0.05em', utilityTransform: 'uppercase',
    radiusButton: '2px', radiusCard: '2px', radiusImage: '2px', shadowCard: 'none',
    fonts: ['IBM Plex Sans', 'Roboto Condensed', 'Space Grotesk'],
  },
  yard: {
    ink: '#16160F', structure: '#2A2A22', accent: '#E0A526', edge: '#CFCDC0',
    paper: { light: '#FAF9F4', default: '#F4F3EC', warm: '#F2EFE4' },
    fontDisplay: 'Saira Condensed', fontBody: 'Barlow', fontUtility: 'Barlow',
    displayWeight: '700', displayTracking: '0.01em', bodyLine: '1.55',
    utilityWeight: '600', utilityTracking: '0.07em', utilityTransform: 'uppercase',
    radiusButton: '0px', radiusCard: '0px', radiusImage: '0px', shadowCard: 'none',
    fonts: ['Saira Condensed', 'Archivo Black', 'Anton'],
  },
  clinic: {
    ink: '#1B2327', structure: '#2F5561', accent: '#4A8B7B', edge: '#E3E2DC',
    paper: { light: '#FFFFFF', default: '#FBFAF7', warm: '#F9F6EF' },
    fontDisplay: 'Fraunces', fontBody: 'Karla', fontUtility: 'Karla',
    displayWeight: '500', displayTracking: '-0.01em', bodyLine: '1.75',
    utilityWeight: '600', utilityTracking: '0.08em', utilityTransform: 'uppercase',
    radiusButton: '6px', radiusCard: '8px', radiusImage: '4px',
    shadowCard: '0 1px 2px rgba(27,35,39,0.06)',
    fonts: ['Fraunces', 'Bitter', 'Nunito'],
  },
}

/** The display faces a theme permits: its default plus two alternates. Free text is never accepted. */
export function fontsFor(theme: Theme): string[] {
  return [...(KITS[theme] ?? KITS[DEFAULT_THEME]).fonts]
}

// ── Accent validation ────────────────────────────────────────────────────────

/**
 * Validate and, where necessary, correct a customer's accent colour.
 *
 * This is the load-bearing function in the file. Customers give us the colour off their logo, and
 * logo colours routinely fail as interface colours — equipment yellow is the standard example and
 * a common real answer. Passing a supplied hex through unchecked produces a site with unreadable
 * buttons and unreadable links, which is worse than ignoring their brand entirely.
 *
 * Three outcomes, and both values are always returned:
 *   text_safe    ≥ 4.5:1 against paper — usable for text and for fills
 *   surface_only fails as text, but WORKS AS A FILL — buttons get accent fill with --ink text
 *   derived      works as neither — darkened in OKLCH until it clears 4.5:1, hue preserved
 *
 * ── The surface_only test is not the one the brief specified, and here is why ──
 * The brief's algorithm puts surface_only at ≥ 3.0:1 against paper. Its own required outcomes
 * cannot both hold under that rule: Yard's equipment yellow `#E0A526` measures **1.97:1** on Yard's
 * paper and must come back `surface_only`, while `#FFE500` measures **1.21:1** on Counsel's and
 * must come back `derived`. Both are below 3.0, so no threshold at 3.0 separates them.
 *
 * What actually separates them is what a fill needs, which is two things rather than one:
 *   1. a button label on the fill must be readable — the better of `--ink` or `--paper` on the
 *      accent clears **3:1**, WCAG's large-text threshold, which is the applicable one because
 *      button labels are large or bold. Requiring 4.5 here rejects Ironclad's own burnt red (4.03)
 *      and Clinic's own sage (4.00), which is how you discover the threshold is wrong: a kit whose
 *      signature colour fails its own validator is not a colour problem, it is a rule problem.
 *   2. the fill must be VISIBLE against the page at all — accent vs paper clears 1.5:1
 *
 * Equipment yellow passes both: dark ink on it is highly readable (8.29:1), and it reads clearly
 * against Yard's paper (1.97:1). A near-white yellow passes the first and fails the second — as a
 * fill it is an almost invisible smudge on white, and as text it is unreadable, so it has to be
 * darkened. That is the honest rule, and it produces both of the brief's required answers while
 * leaving all six kits' own accents intact.
 *
 * The customer's ORIGINAL colour still appears — in their logo, and as a fill wherever contrast
 * permits. The derived value is what touches text and small elements. Never throws: bad input
 * returns the theme's own accent, because a broken colour must not take a site down.
 */
export function validateAccent(
  theme: Theme,
  hex: unknown,
): { accent: string; accent_derived: string; accent_mode: AccentMode } {
  const kit = KITS[theme] ?? KITS[DEFAULT_THEME]
  const paper = kit.paper.default

  const rgb = parseHex(hex)
  if (!rgb) {
    // Unparseable input falls back to the kit's own accent, which is known to work in it.
    return { accent: kit.accent, accent_derived: kit.accent, accent_mode: 'text_safe' }
  }

  const accent = toHex(rgb)

  if (contrastRatio(accent, paper) >= 4.5) {
    return { accent, accent_derived: accent, accent_mode: 'text_safe' }
  }

  // Usable as a fill: a button label on it is readable, and the fill is visible against the page.
  // See the note above on why this is two tests rather than one threshold, and why the label test
  // is 3:1 rather than 4.5:1.
  const labelContrast = Math.max(contrastRatio(kit.ink, accent), contrastRatio(paper, accent))
  const readableOnFill = labelContrast >= 3.0
  const visibleOnPaper = contrastRatio(accent, paper) >= 1.5
  if (readableOnFill && visibleOnPaper) {
    return { accent, accent_derived: accent, accent_mode: 'surface_only' }
  }

  // Darken in OKLCH until it clears 4.5:1 or hits the lightness floor, preserving hue.
  const { L, C, H } = rgbToOklch(rgb)
  let derived = accent
  for (let l = L - 0.02; l >= 0.15; l -= 0.02) {
    derived = toHex(oklchToRgbInGamut(l, C, H))
    if (contrastRatio(derived, paper) >= 4.5) break
  }

  return { accent, accent_derived: derived, accent_mode: 'derived' }
}

// ── Tokens ───────────────────────────────────────────────────────────────────

/**
 * Every custom property a template may read. Prefixed `--le-` so nothing here can collide with the
 * portal's own `--bg-base` / `--text-primary` tokens from `app/globals.css`.
 *
 * Templates contain no hex literal, no font-family, and no hardcoded radius — every one of those
 * comes from this function. `scripts/verify-lead-engine.mjs` enforces it mechanically, because
 * `ignoreBuildErrors: true` means nothing else will.
 *
 * Only three things a customer supplies can reach this output: accent, display face, and paper
 * shade. The type scale, spacing scale, radii, shadow depth, section rhythm, `--le-ink`,
 * `--le-structure` and `--le-edge` are NOT overridable, whatever `brand` happens to contain — they
 * are what keeps a customised site still looking designed. The allowlist below is positive:
 * `brand` is read key by key and never spread, so an unexpected key cannot become a token.
 */
export function tokensFor(theme: Theme, brand?: Brand): Record<string, string> {
  const kit = KITS[theme] ?? KITS[DEFAULT_THEME]

  const shade: PaperShade =
    brand?.paper_shade === 'light' || brand?.paper_shade === 'warm' ? brand.paper_shade : 'default'
  const paper = kit.paper[shade]

  // A brand accent is re-validated here rather than trusted from storage: the stored value was
  // validated against the theme it was saved under, and an operator can change the theme later.
  const accentInput = brand?.accent
  const resolved = accentInput ? validateAccent(theme, accentInput) : {
    accent: kit.accent,
    accent_derived: validateAccent(theme, kit.accent).accent_derived,
    accent_mode: validateAccent(theme, kit.accent).accent_mode,
  }

  const display = brand?.display_font && kit.fonts.includes(brand.display_font)
    ? brand.display_font
    : kit.fontDisplay

  return {
    '--le-ink':       kit.ink,
    '--le-structure': kit.structure,
    '--le-paper':     paper,
    '--le-edge':      kit.edge,
    '--le-accent':          resolved.accent,
    '--le-accent-derived':  resolved.accent_derived,

    '--le-font-display': `"${display}"`,
    '--le-font-body':    `"${kit.fontBody}"`,
    '--le-font-utility': `"${kit.fontUtility}"`,
    '--le-display-weight':   kit.displayWeight,
    '--le-display-tracking': kit.displayTracking,
    '--le-body-line':        kit.bodyLine,
    '--le-utility-weight':    kit.utilityWeight,
    '--le-utility-tracking':  kit.utilityTracking,
    '--le-utility-transform': kit.utilityTransform,

    '--le-radius-button': kit.radiusButton,
    '--le-radius-card':   kit.radiusCard,
    '--le-radius-image':  kit.radiusImage,
    '--le-shadow-card':   kit.shadowCard,

    // Type scale — identical across kits, never overridable. Display-to-body must clear 3.5x.
    '--le-display-xl': 'clamp(3.25rem, 7vw, 6rem)',
    '--le-display-l':  'clamp(2.25rem, 4vw, 3.5rem)',
    '--le-display-m':  'clamp(1.5rem, 2.2vw, 2rem)',
    '--le-body-l':     '1.125rem',
    '--le-body':       '1rem',
    '--le-utility':    '0.8125rem',

    // Section rhythm. Anchor sections carry weight; connectors sit between them.
    '--le-space-anchor':    '128px',
    '--le-space-connector': '64px',
    '--le-space-anchor-m':    '64px',
    '--le-space-connector-m': '40px',
  }
}

/**
 * The accent mode actually in force on a page — for the kit's OWN accent as much as for a
 * customer override.
 *
 * The route used to compute this only when `brand.accent` was set, and defaulted to `text_safe`
 * otherwise. That is wrong for any kit whose own accent is not text-safe: **Yard's equipment
 * yellow is surface_only**, so every rental site rendered paper-coloured labels on a yellow fill —
 * about 1.6:1, unreadable — with no customer override involved at all.
 *
 * The mode is a property of the accent that ends up on the page, whoever supplied it.
 */
export function accentModeFor(theme: Theme, brand?: Brand): AccentMode {
  const kit = KITS[theme] ?? KITS[DEFAULT_THEME]
  return validateAccent(theme, brand?.accent ?? kit.accent).accent_mode
}

/** The token map as an inline `style` object for a React element. */
export function tokenStyle(theme: Theme, brand?: Brand): Record<string, string> {
  return tokensFor(theme, brand)
}
