# Lead Engine — Design Layer Implementation Brief

**Audience:** the Claude Code agent working in the 369 Agentic Systems repo.
**Branch:** `feature/lead-engine`. `master` is not touched.
**Companion file:** install `SKILL.md` at `.claude/skills/site-design-system/SKILL.md` before starting. It is the design reference; this file is the build order. Do not duplicate its content into code comments — reference it.

---

## 0. Read this first

You are adding a **design layer** to the Lead Engine plan. The plan's schema, routes, delivery chunks, and verification gates stand as written. This brief changes three things:

1. Five templates instead of three.
2. A `theme` column and a `brand` jsonb column on `lead_engine_sites`.
3. A pure `lib/lead-engine/theme.ts` module that resolves vertical → template + theme, and validates customer brand input.

Everything else in the plan is unchanged. Do not revive the `clients` table. Do not modify `agent_subscriptions`. Do not apply `2026-07-24-...-PROPOSED.sql`. Do not add cron entries to `vercel.json`.

### The model in one paragraph

A client site is `template × theme × brand`. **Template** is section order — it maps to the customer's buying question, so roofing and plumbing share one. **Theme** is visual identity — palette, type, radius, motion. **Brand** is the customer's own accent color, display font, and logo, applied *within* a theme and validated so it cannot break contrast. Five templates × six themes = thirty looks from five component sets. Design never lives in `content` jsonb; `content` is customer data, and keeping them apart means an admin can re-theme a live site with no content diff and a re-submitted questionnaire can never alter the look.

---

## 1. Constraints carried forward from the plan

These are verified facts about the repo. Do not re-derive them; do not violate them.

- `next.config.mjs` has `ignoreBuildErrors: true`. The build catches nothing. **`npx tsc --noEmit` is a mandatory manual gate.**
- Tests run via `npm test` → `node --test lib/**/*.test.ts`. 338 exist. Parameter properties do not run under the resolver — use plain assignment in constructors.
- `resendFrom()` from `lib/email-from.ts` is mandatory for all mail. `escapeHtml` from `lib/security/sanitize.ts` for all interpolated user data.
- RLS is `USING (true) TO authenticated` on existing portal tables; app-code filters are the real boundary. New `lead_engine_*` tables get real per-tenant policies plus the `public.is_369_admin()` carve-out.
- Every route must survive its tables not existing yet. Schema and code go live separately in this project.
- `app/` already owns: `agents, api, auth, book-demo, dental, dossier, dumpster-rental, equipment-rental, event-rentals, founding, hvac, insurance, legal, onboarding, onboarding-complete, plumbing, privacy, real-estate, roofing, saas, terms, wholesale`. Root `templates/` holds CSV data — **template components go in `components/lead-engine/templates/`.**
- Stripe is test mode with the sole webhook disabled. No checkout work. Sites are admin-created and invoiced by hand.

---

## 2. Migration

Extend `supabase/migrations/2026-08-23-lead-engine.sql`. Add to the `lead_engine_sites` definition:

```sql
template text not null default 'service_clean'
  check (template in (
    'trade_classic','service_clean','showcase_grid','practice','supply'
  )),

theme text not null default 'counsel'
  check (theme in (
    'ironclad','counsel','threshold','ledger','yard','clinic'
  )),

brand jsonb not null default '{}'::jsonb,
```

Defaults are the safest pair, not the common one: Service Clean carries a page with no photos, and Counsel is the most conservative theme. A row created before its vertical is known renders acceptably rather than broken.

`brand` shape (all keys optional):

```json
{
  "accent": "#C8542B",
  "accent_derived": "#A8441F",
  "accent_mode": "text_safe | surface_only | derived",
  "display_font": "Archivo Black",
  "paper_shade": "light | default | warm",
  "logo_url": "lead-engine-photos/<site_id>/logo.svg",
  "logo_treatment": "mark | wordmark | lockup"
}
```

Append the same definitions to `supabase/schema.sql` so it stays the reference.

**Do not** add a `vertical` column to `lead_engine_sites`. Vertical is an input to `createSite()`, not stored state — `template` and `theme` are the resolved output, and storing the input invites the two-writer bug the plan already calls out. If an admin needs to re-derive later, they pass the vertical again.

---

## 3. `lib/lead-engine/theme.ts`

Pure. No I/O. Same shape as `slug.ts` and `limits.ts`. Fully tested in `theme.test.ts`.

```ts
export type Template =
  | 'trade_classic' | 'service_clean' | 'showcase_grid'
  | 'practice' | 'supply';

export type Theme =
  | 'ironclad' | 'counsel' | 'threshold'
  | 'ledger' | 'yard' | 'clinic';

export type AccentMode = 'text_safe' | 'surface_only' | 'derived';

export interface Brand {
  accent?: string;
  accent_derived?: string;
  accent_mode?: AccentMode;
  display_font?: string;
  paper_shade?: 'light' | 'default' | 'warm';
  logo_url?: string;
  logo_treatment?: 'mark' | 'wordmark' | 'lockup';
}

/** Vertical -> default template + theme. Unknown vertical returns the
 *  safe default pair, never throws. */
export function resolveForVertical(vertical: string):
  { template: Template; theme: Theme };

/** Theme tokens as CSS custom properties, brand overrides applied. */
export function tokensFor(theme: Theme, brand?: Brand):
  Record<string, string>;

/** Validate and correct a customer accent against a theme's paper.
 *  Never throws. Invalid hex returns the theme default unchanged. */
export function validateAccent(theme: Theme, hex: string):
  { accent: string; accent_derived: string; accent_mode: AccentMode };

/** Permitted display faces for a theme. Default is index 0. */
export function fontsFor(theme: Theme): string[];

/** Layout actually rendered, given stated template and photo count.
 *  Returns 'service_clean' when photos are absent. Theme is unaffected. */
export function effectiveTemplate(
  template: Template, photoCount: number
): Template;
```

### `resolveForVertical` mapping

```
roofing, hvac, plumbing, electrical, concrete,
tree_service, general_contracting  → trade_classic + ironclad
real_estate, property_mgmt, mortgage → trade_classic + threshold
legal, insurance, accounting, consulting, cleaning → service_clean + counsel
dumpster_rental, equipment_rental,
event_rentals, hauling             → showcase_grid + yard
wholesale, distribution, b2b_supply → supply + ledger
dental, medical, veterinary,
chiropractic, optometry            → practice + clinic
(unknown)                          → service_clean + counsel
```

### `validateAccent` algorithm

This is the load-bearing function. Customers supply logo colors that fail as interface colors — yellow logos are common. Never pass a supplied hex through unchecked.

```
1. Parse hex. Invalid → return theme default, mode 'text_safe'.
2. contrast = WCAG ratio of accent against the theme's --paper.
3. contrast >= 4.5  → mode 'text_safe',   accent_derived = accent
4. contrast >= 3.0  → mode 'surface_only', accent_derived = accent
5. contrast <  3.0  → mode 'derived'. Convert to OKLCH, reduce L in 0.02
                      steps preserving H and C until ratio >= 4.5 or L
                      hits 0.15 floor. accent_derived = result.
6. Always return both values.
```

Consumption rule for templates: use `accent` for logo and large fills; use `accent_derived` for any text, icon, border, or element under 24px. In `surface_only` and `derived` modes, buttons render as accent fill with `--ink` text — never accent-colored text on paper.

Implement contrast and OKLCH conversion inline. Do not add a dependency for ~60 lines of color math.

### Required tests (`theme.test.ts`)

- Every vertical in the mapping returns its documented pair
- Unknown vertical returns `service_clean` + `counsel`, does not throw
- `validateAccent` with Yard's `#E0A526` returns `surface_only`
- A pure yellow such as `#FFE500` returns `derived` with a darker value clearing 4.5:1
- Malformed input (`""`, `"red"`, `"#GGG"`, `null`) returns the theme default and does not throw
- Derived accent preserves hue within 5 degrees of the original
- `effectiveTemplate(x, 0) === 'service_clean'` for all five templates
- `effectiveTemplate(x, n>0) === x` for all five
- `tokensFor` returns every documented custom property for all six themes
- `tokensFor` never emits a token the SKILL marks non-overridable, whatever `brand` contains

---

## 4. Components

`components/lead-engine/`

```
SiteSections.tsx      shared primitives + the ThemeProvider wrapper
templates/
  TradeClassic.tsx
  ServiceClean.tsx
  ShowcaseGrid.tsx
  Practice.tsx
  Supply.tsx
LeadForm.tsx
Gallery.tsx
PhotoUploader.tsx
```

**Theme application:** `SiteSections.tsx` exports a single wrapper that sets `tokensFor(theme, brand)` as inline CSS custom properties on one div. Templates render inside it. There are **no per-theme component variants** — one set of components, six token sets.

**Hard rule:** template and primitive components contain no hex literal, no `font-family` declaration, no hardcoded radius or shadow. Every one comes from a `var(--*)`. This is mechanically testable and you will add that test in §6.

Fonts: load via `next/font/google`, subset, and only the faces the resolved theme needs. Do not load all six themes' faces on every site.

---

## 5. Where this lands in the delivery chunks

The plan's three chunks stand. Design work slots into A and C.

### Chunk A (Phases 1–2) — do this now

Add to the existing scope:

- Migration columns from §2
- `lib/lead-engine/theme.ts` + `theme.test.ts` complete
- All five templates, not three
- `SiteSections.tsx` with the token wrapper
- `effectiveTemplate` wired into `app/sites/[slug]/page.tsx`
- Seed script producing one site per template so all five can be viewed

**Verification point:** Chris opens all five seeded sites and reads them as a customer would. Run `node scripts/mobile-audit.mjs` with `/sites/<slug>` added — do not reason about breakpoints instead of running it.

Screenshot each template at 1440px and 375px and attach them to the chunk summary. Design defects are not visible in code review; the plan's own note applies — read the artifact, not the code that made it.

### Chunk B (Phases 3–5) — unchanged

Questionnaire, lead form, notification, dashboard. One addition: the questionnaire's photo question already branches; make the "no photos" branch set nothing on `template` — the degrade is computed, never stored.

### Chunk C (Phases 6–7)

Add to the existing scope:

- Brand override fields in the admin edit page: accent color picker, display font select populated from `fontsFor(theme)`, paper shade, logo upload
- Surface `accent_mode` in the admin UI when a correction fired, so an admin can see the customer's color was adjusted and why
- Template and theme selects on the admin edit page, defaulted from `resolveForVertical()` but overridable

---

## 6. Verification gates

All existing gates plus two.

```bash
npx tsc --noEmit          # mandatory — the build catches nothing
npm test                  # 338 existing + new lib/lead-engine/*.test.ts
node scripts/mobile-audit.mjs   # with /sites/<slug> added
node scripts/verify-lead-engine.mjs
```

**New — add to `scripts/verify-lead-engine.mjs`:**

Hardcoded-style check. Fail if any file under `components/lead-engine/` matches:

- `#[0-9a-fA-F]{3,8}\b` outside a comment
- `font-family:` or `fontFamily:` with a literal value
- `border-radius:` / `borderRadius:` with a literal px value

This is cheap and it is the only thing standing between you and theme drift, given `ignoreBuildErrors: true`.

**New — pain-point assertion.** `content.test.ts` must assert that questionnaire Q10 never appears in mapper output. The plan already requires this; it is restated because a template author is the most likely person to break it.

---

## 7. Do not

- Do not add a sixth template or seventh theme. If a vertical genuinely fits none, report the gap and stop.
- Do not let a template invent a layout, a color, or a section. Compose from the SKILL.
- Do not accept free-text font input. Allowlist only.
- Do not store the degraded template value.
- Do not put template, theme, or brand inside `content` jsonb.
- Do not render placeholder text, empty frames, or invented statistics.
- Do not claim SMS, booking, deposits, instant quoting, or live availability anywhere. Twilio is unconfigured in every environment.
- Do not add a `vertical` column, revive `clients`, modify `agent_subscriptions`, apply the PROPOSED migration, or add a cron entry.

---

## 8. Open question for Chris

`resolveForVertical()` needs a vertical string at `createSite()` time. Confirm the admin create form collects it as a controlled select using the exact keys in §3, rather than free text. Free text means the mapping silently falls through to the default pair and every site looks like a law firm.
