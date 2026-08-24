/**
 * The grid, the theme wrapper, and every section primitive the five templates compose from.
 *
 * Design reference: `.claude/skills/site-design-system/SKILL.md`. Its §1 and §3 now carry the
 * numeric grid values below; where a value looks arbitrary, that file is why.
 *
 * ── The hard rule this file exists to hold ──
 * No hex literal, no `font-family` with a literal value, no hardcoded radius or shadow, in this
 * file or in any template. Every one comes from a `var(--le-*)` emitted by `tokensFor()`.
 * `scripts/verify-lead-engine.mjs` checks it mechanically, because `ignoreBuildErrors: true` means
 * nothing else ever will.
 *
 * ── The rule that fixed the composition ──
 * **No section leaves more than three consecutive columns empty.** A section with six columns of
 * content is either genuinely two-column, or centred at a narrower max-width. It is never
 * left-aligned with dead space beside it. Chunk A got the section ORDER right and the section
 * COMPOSITION wrong, and this single rule is most of the difference.
 *
 * ── Why the sites opt out of the portal's CSS ──
 * `app/globals.css` paints `body` with our dark admin theme on every Next route, and
 * `app/layout.tsx` toggles `html.light` from a `portal-theme` key in **the visitor's own
 * localStorage** — so a stranger reading a roofer's site would get our dark Command Center palette
 * while someone who had used our portal got a different page. Hence: own class names, own tokens.
 */

import type { ReactNode } from 'react'
import type { FaqItem, ServiceItem, SiteContent, SitePhoto, Testimonial } from '@/lib/lead-engine/types'
import type { Brand, Theme } from '@/lib/lead-engine/theme'
import { tokensFor } from '@/lib/lead-engine/theme'
import { telHref } from '@/lib/lead-engine/content'
import {
  coverageColumns, coverageRenders, galleryLayout, proofBarRenders, proofFacts,
  heroLede, servicesColumns, whyUsItems,
} from '@/lib/lead-engine/sections'

export { coverageRenders, proofBarRenders } from '@/lib/lead-engine/sections'

export function ThemeShell({
  theme, brand, fontClass, accentMode = 'text_safe', density = 'full', children,
}: {
  theme: Theme
  brand?: Brand
  fontClass?: string
  /**
   * Which branch validateAccent took. MUST land on .le-site itself — it was previously set on a
   * wrapper div outside it, so every `.le-site[data-accent-mode=...]` rule silently never matched
   * and the button-contrast correction had never once fired on any page.
   */
  accentMode?: 'text_safe' | 'surface_only' | 'derived'
  /** 'compact' tightens the vertical rhythm on a page with fewer than five sections. */
  density?: 'full' | 'compact'
  children: ReactNode
}) {
  return (
    <div
      className={`le-site${fontClass ? ` ${fontClass}` : ''}`}
      data-accent-mode={accentMode}
      data-density={density}
      style={tokensFor(theme, brand) as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      {children}
    </div>
  )
}

/**
 * The only literals below are structural — column counts, gutters, hairlines, aspect ratios and
 * the spacing scale. None of those is a decision a theme owns.
 *
 * NO BACKTICKS ANYWHERE IN THIS STRING, including inside comments. It is a template literal, so a
 * backtick terminates it and the whole file stops parsing — which has now happened twice, both
 * times from quoting a CSS property name in prose. Write property names bare.
 */
const SITE_CSS = `
.le-site {
  background: var(--le-paper);
  color: var(--le-ink);
  font-family: var(--le-font-body), system-ui, sans-serif;
  font-size: var(--le-body);
  line-height: var(--le-body-line);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  /* Deliberately NO overflow-x: hidden. It was here to mask the hero's negative-margin bleed, and
     it does two bad things: it hides overflow rather than removing it (the audit still reports the
     clipped element, and part of the photo is genuinely cut off), and an overflow-x on an ancestor
     breaks position: sticky on the header inside it. Both bleeds below are now computed so they
     cannot overflow in the first place. */
}
.le-site *, .le-site *::before, .le-site *::after { box-sizing: border-box; }
/* ── Two overflow defences, and they are not interchangeable ────────────────────
   Measured at 320px, not assumed:

     neither                     Service Clean 329px  (+9 overflow)
     overflow-wrap only          320px OK
     min-width:0 only            329px  (+9)  AND Supply regressed to 340px (+20)
     both                        320px OK everywhere

   So the failure that actually bit us was TEXT that could not wrap, not a grid track that refused
   to shrink. min-width: 0 alone does not fix it — and applied bluntly it makes things worse,
   because letting a box shrink without letting its text wrap just pushes the text further out.

   Both are kept, for different failure modes:
   - overflow-wrap handles customer-typed strings, which is every string on these pages.
   - min-width: 0 handles a grid or flex child that will not shrink below its content: an image,
     a table, a long unbreakable URL. min-width: auto is the default on those children and is
     the classic cause. Scoped to the layout containers rather than *, because the universal
     version measurably changed layout elsewhere.

   The enumerated list below cannot cover a layout container added later. That is what the 320px
   assertion in scripts/verify-lead-engine.mjs is for — it renders every fixture and fails on any
   horizontal scroll, whatever caused it.
*/
.le-site { overflow-wrap: break-word; }
.le-site :where(
  .le-grid, .le-hero-inner, .le-proof, .le-svc-list, .le-cover,
  .le-gal, .le-gal-stack, .le-header-inner, .le-header-actions, .le-actions, .le-faq
) > * { min-width: 0; }
.le-site :focus-visible { outline: 2px solid var(--le-accent-derived); outline-offset: 2px; }

/* ── Grid: 12 columns, 1280 container, 32px gutter ─────────────────────────── */
.le-wrap { max-width: 1280px; margin: 0 auto; padding: 0 48px; }
.le-grid { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 32px; }
.le-c1-5  { grid-column: 1 / 6;  }
.le-c1-6  { grid-column: 1 / 7;  }
.le-c1-8  { grid-column: 1 / 9;  }
.le-c7-12 { grid-column: 7 / 13; }
.le-c1-12 { grid-column: 1 / -1; }

/* Full-bleed. Rendered outside .le-wrap, so it is already the full page width — width: 100%
   rather than 100vw, because 100vw includes the vertical scrollbar and overflows by its width. */
.le-bleed-out { width: 100%; }

.le-anchor    { padding: var(--le-space-anchor) 0; }
.le-connector { padding: var(--le-space-connector) 0; }
/* A short page with tall gaps reads as broken; a short page with tight rhythm reads as deliberate.
   Set from sectionCount() — fewer than five sections and 128px between three-line sections is void
   rather than rhythm. This is what review-sparse, the site a customer with no photos receives,
   needed most. */
.le-site[data-density="compact"] .le-anchor    { padding: var(--le-space-anchor-m) 0; }
.le-site[data-density="compact"] .le-connector { padding: var(--le-space-connector-m) 0; }
.le-band      { background: var(--le-structure); color: var(--le-paper); }
.le-band .le-eyebrow { color: var(--le-paper); opacity: 0.72; }

.le-eyebrow {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility);
  font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking);
  text-transform: var(--le-utility-transform);
  color: var(--le-accent-derived);
  margin: 0 0 24px;
}

.le-h1, .le-h2, .le-h3 {
  font-family: var(--le-font-display), Georgia, serif;
  font-weight: var(--le-display-weight);
  letter-spacing: var(--le-display-tracking);
  margin: 0;
  line-height: 1.05;
}
.le-h1 { font-size: clamp(3.5rem, 6vw, 5.5rem); max-width: 13ch; }
.le-h2 { font-size: var(--le-display-l); margin-bottom: 32px; }
.le-h3 { font-size: var(--le-display-m); line-height: 1.2; }

.le-p    { margin: 0 0 16px; max-width: 62ch; }
.le-lede { font-size: var(--le-body-l); max-width: 42ch; }

.le-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--le-accent); color: var(--le-paper);
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-body); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking);
  text-transform: var(--le-utility-transform);
  text-decoration: none;
  padding: 18px 32px; min-height: 56px;
  border: 0; border-radius: var(--le-radius-button); cursor: pointer;
}
.le-btn:hover { filter: brightness(1.08); }

/* ── Button colour per accent mode ──────────────────────────────────────────────
   text_safe    accent fill, paper label. The accent clears 4.5:1 on paper, so it is dark enough.
   surface_only accent fill, INK label. The accent works as a fill but is too light for paper text
                — equipment yellow is the standard case.
   derived      the ORIGINAL accent is not usable as a fill either: derived means it failed the
                visibility test against paper, so a button in it is a nearly invisible shape.
                The fill becomes accent-derived, which by construction clears 4.5:1 on paper and
                therefore carries a paper label.

   The original colour still appears — in the logo, and as a fill in the two modes above where
   contrast permits. That is the whole point of storing both values.

   These selectors require data-accent-mode on .le-site itself. It used to be set on a wrapper div
   outside it, so none of this had ever applied. */
.le-site[data-accent-mode="surface_only"] .le-btn,
.le-site[data-accent-mode="surface_only"] .le-submit { color: var(--le-ink); }
.le-site[data-accent-mode="derived"] .le-btn,
.le-site[data-accent-mode="derived"] .le-submit {
  background: var(--le-accent-derived); color: var(--le-paper);
}

.le-btn-sm { padding: 12px 22px; min-height: 44px; font-size: var(--le-utility); }

/* The phone is an equal-weight action beside the CTA, not a footnote under it. */
.le-tel {
  display: inline-flex; align-items: center; min-height: 44px;
  padding: 6px 10px; margin: -6px -10px;
  border-radius: var(--le-radius-button);
  color: var(--le-accent-derived); text-decoration: none;
  font-size: var(--le-display-m); font-weight: 600;
  font-family: var(--le-font-display), Georgia, serif;
}
.le-tel:hover { text-decoration: underline; }
.le-band .le-tel { color: var(--le-paper); }

.le-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; margin-top: 40px; }

/* ── Site header ───────────────────────────────────────────────────────────── */
.le-header {
  position: sticky; top: 0; z-index: 50; height: 72px;
  background: var(--le-paper); border-bottom: 1px solid var(--le-edge);
  backdrop-filter: blur(8px);
}
.le-header-inner { display: flex; align-items: center; justify-content: space-between; height: 72px; gap: 24px; }
.le-header-name {
  font-family: var(--le-font-display), Georgia, serif;
  font-size: var(--le-display-m); font-weight: var(--le-display-weight);
  letter-spacing: var(--le-display-tracking);
  text-decoration: none; color: var(--le-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.le-header-logo { max-height: 40px; width: auto; display: block; }
.le-header-actions { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.le-header .le-tel { font-size: var(--le-body); font-family: var(--le-font-body), system-ui, sans-serif; }

/* ── Hero: split anchor ────────────────────────────────────────────────────── */
/*
   The image occupies the right half of the VIEWPORT while the text stays aligned to the container.
   Done by padding the text column rather than by pulling the image out with a negative margin: a
   negative margin on a grid item resolves its percentage against the grid's content box, not the
   container, so it overshot the viewport edge at every width above 768px and was only invisible
   because an overflow:hidden was hiding it.

   calc(50vw - 640px + 48px) is the container's own left inset — half the viewport, minus half of
   the 1280px container, plus its 48px padding. max() clamps it once the viewport is narrower
   than the container. No negative margins, so there is nothing to overflow.
*/
.le-hero { position: relative; }
.le-hero-inner { display: grid; grid-template-columns: 1fr 1fr; align-items: center; }
.le-hero-text {
  padding-top: 96px; padding-bottom: 96px;
  padding-left: max(48px, calc(50vw - 640px + 48px));
  padding-right: 48px;
}
.le-hero-media { min-height: 620px; align-self: stretch; }
.le-hero-fact {
  margin: 32px 0 0; font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.7;
}
.le-hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── Proof bar ─────────────────────────────────────────────────────────────── */
.le-proof {
  border-top: 1px solid var(--le-edge); border-bottom: 1px solid var(--le-edge);
  padding: 40px 0; display: grid; column-gap: 32px; row-gap: 24px;
}
.le-proof-4 { grid-template-columns: repeat(4, 1fr); }
.le-proof-3 { grid-template-columns: repeat(3, 1fr); }
.le-proof-2 { grid-template-columns: repeat(2, 1fr); }
.le-proof-1 { grid-template-columns: 1fr; }
.le-proof dt {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.6; margin: 0 0 8px;
}
.le-proof dd {
  margin: 0; font-size: var(--le-display-m); font-weight: 600;
  font-family: var(--le-font-display), Georgia, serif; line-height: 1.25;
}

/* ── Services 5a: alternating ladder ───────────────────────────────────────── */
.le-ladder-row { align-items: center; margin-bottom: 96px; }
.le-ladder-row:last-child { margin-bottom: 0; }
.le-ladder-img { grid-column: 1 / 6; aspect-ratio: 4 / 3; }
.le-ladder-txt { grid-column: 7 / 13; }
.le-ladder-row:nth-child(even) .le-ladder-img { grid-column: 8 / 13; grid-row: 1; }
.le-ladder-row:nth-child(even) .le-ladder-txt { grid-column: 1 / 6;  grid-row: 1; }
.le-ladder-img img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: var(--le-radius-image); }
.le-ladder-txt h3 { font-size: var(--le-display-l); }
.le-ladder-txt p { margin: 16px 0 0; font-size: var(--le-body-l); max-width: 46ch; }

/* ── Services 5b: two-column list ──────────────────────────────────────────── */
.le-svc-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 64px; row-gap: 48px; }
.le-svc-item { border-top: 1px solid var(--le-edge); padding-top: 20px; }
.le-svc-item h3 { margin-bottom: 12px; }
.le-svc-item p { margin: 0; max-width: 38ch; opacity: 0.7; }

/* ── Why us ────────────────────────────────────────────────────────────────── */
.le-why-head { grid-column: 1 / 6; position: sticky; top: 104px; align-self: start; }
.le-why-items { grid-column: 7 / 13; }
.le-why-item { border-top: 1px solid var(--le-edge); padding-top: 20px; margin-bottom: 48px; }
.le-why-item:last-child { margin-bottom: 0; }
.le-why-item p { margin: 12px 0 0; max-width: 42ch; }
.le-why-single { max-width: 62ch; margin: 0 auto; text-align: center; }

/* ── Gallery: fixed ratios, six maximum ────────────────────────────────────── */
.le-gal { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
.le-gal-feature { grid-column: 1 / 9;  aspect-ratio: 3 / 2; }
.le-gal-stack   { grid-column: 9 / 13; display: grid; gap: 16px; }
.le-gal-stack > * { aspect-ratio: 4 / 3; }
.le-gal-rest    { aspect-ratio: 4 / 3; }
.le-gal img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: var(--le-radius-image); }

/* ── Coverage ──────────────────────────────────────────────────────────────── */
.le-cover { display: grid; grid-template-columns: repeat(4, 1fr); column-gap: 32px; row-gap: 16px; }
.le-cover li {
  list-style: none; border-bottom: 1px solid var(--le-edge);
  padding: 12px 0; font-size: var(--le-utility);
  font-family: var(--le-font-utility), system-ui, sans-serif;
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
}
.le-cover-note { margin: 24px 0 0; opacity: 0.7; }

/* ── Trust ─────────────────────────────────────────────────────────────────── */
.le-quote p { font-size: var(--le-body-l); max-width: 34ch; margin: 0; }
.le-quote footer {
  margin-top: 24px; font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.65;
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */
.le-faq { grid-column: 1 / 9; }
.le-faq details { border-top: 1px solid var(--le-edge); }
.le-faq summary {
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  padding: 24px 0; cursor: pointer; list-style: none;
  font-family: var(--le-font-display), Georgia, serif;
  font-size: var(--le-display-m); font-weight: var(--le-display-weight);
  letter-spacing: var(--le-display-tracking); line-height: 1.25;
}
.le-faq summary::-webkit-details-marker { display: none; }
/* The +/- indicator, drawn in text rather than pulled from an icon library. */
.le-faq summary::after { content: "+"; font-weight: 400; opacity: 0.5; flex-shrink: 0; }
.le-faq details[open] summary::after { content: "\\2212"; }
.le-faq details p { margin: 0 0 24px; max-width: 62ch; opacity: 0.8; }

/* ── Terminal CTA ──────────────────────────────────────────────────────────── */
.le-cta-band { padding: 96px 0; }
.le-cta-left  { grid-column: 1 / 6; }
.le-cta-right { grid-column: 7 / 13; }
.le-cta-left .le-h2 { color: var(--le-paper); }
.le-field-label { font-size: var(--le-utility); font-weight: 600; margin-bottom: 8px; opacity: 0.8; }
.le-field {
  background: color-mix(in oklab, var(--le-paper) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--le-paper) 20%, transparent);
  border-radius: var(--le-radius-card);
  color: var(--le-paper);
}
.le-submit {
  display: flex; align-items: center; justify-content: center; width: 100%;
  /* Paper label by default, matching .le-btn. Ink on a text_safe accent (Counsel's aged brass, for
     instance) is dark-on-dark — the per-mode rules above are what change it. */
  background: var(--le-accent); color: var(--le-paper);
  border-radius: var(--le-radius-button); min-height: 56px; padding: 18px 32px;
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-body); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
}

/* ── Footer ────────────────────────────────────────────────────────────────── */
.le-foot { border-top: 1px solid var(--le-edge); padding: 40px 0 56px; }
.le-foot a {
  color: var(--le-accent-derived); display: inline-block;
  padding: 13px 8px; margin: -13px -8px; min-height: 44px;
}
.le-foot .le-tel { font-size: var(--le-body); font-family: var(--le-font-body), system-ui, sans-serif; }
.le-credit { margin-top: 20px; font-size: var(--le-utility); opacity: 0.6; }

/* ── Tablet ────────────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .le-wrap { padding: 0 24px; }
  .le-cover { grid-template-columns: repeat(3, 1fr); }
}

/* ── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .le-wrap { padding: 0 20px; }
  .le-grid { column-gap: 0; }
  .le-anchor    { padding: var(--le-space-anchor-m) 0; }
  .le-connector { padding: var(--le-space-connector-m) 0; }

  .le-c1-5, .le-c1-6, .le-c1-8, .le-c7-12, .le-c1-12,
  .le-ladder-img, .le-ladder-txt, .le-why-head, .le-why-items,
  .le-cta-left, .le-cta-right, .le-faq,
  .le-ladder-row:nth-child(even) .le-ladder-img,
  .le-ladder-row:nth-child(even) .le-ladder-txt { grid-column: 1 / -1; }

  .le-header, .le-header-inner { height: 60px; }
  .le-header .le-btn { display: none; }

  /* Photo above the text on mobile, per the SKILL's split-anchor note. */
  .le-hero-inner { grid-template-columns: 1fr; }
  .le-hero-text { padding: 40px 20px; }
  .le-h1 { font-size: clamp(2.5rem, 9vw, 3.25rem); max-width: none; }
  .le-hero-media { grid-row: 1; min-height: 320px; height: 320px; }

  .le-proof-4, .le-proof-3 { grid-template-columns: repeat(2, 1fr); }
  .le-ladder-row { margin-bottom: 48px; }
  .le-ladder-row:nth-child(even) .le-ladder-img,
  .le-ladder-row:nth-child(even) .le-ladder-txt { grid-row: auto; }
  .le-svc-list { grid-template-columns: 1fr; row-gap: 32px; }
  .le-why-head { position: static; margin-bottom: 40px; }

  .le-gal { grid-template-columns: repeat(2, 1fr); }
  .le-gal-feature { grid-column: 1 / -1; }
  .le-gal-stack   { grid-column: 1 / -1; grid-template-columns: repeat(2, 1fr); }
  .le-gal-rest    { grid-column: span 1 !important; }

  .le-cover { grid-template-columns: repeat(2, 1fr); }
  .le-cta-band { padding: 56px 0; }
  .le-btn { width: 100%; }
  .le-actions { gap: 16px; margin-top: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .le-site *, .le-site *::before, .le-site *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .le-why-head { position: static; }
}
`

// ── Primitives ───────────────────────────────────────────────────────────────

export function Section({
  id, density = 'anchor', band, children,
}: { id?: string; density?: 'anchor' | 'connector'; band?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={[density === 'anchor' ? 'le-anchor' : 'le-connector', band ? 'le-band' : ''].join(' ').trim()}>
      <div className="le-wrap">{children}</div>
    </section>
  )
}

/** Eyebrow + heading, occupying half the grid so the other half can carry content. */
export function SectionHead({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  return (
    <>
      <p className="le-eyebrow">{eyebrow}</p>
      <h2 className="le-h2">{heading}</h2>
    </>
  )
}

export function CtaButton({ content, small }: { content: SiteContent; small?: boolean }) {
  const cls = small ? 'le-btn le-btn-sm' : 'le-btn'
  return content.cta.kind === 'call' && content.phone
    ? <a className={cls} href={telHref(content.phone)}>{content.cta.label}</a>
    : <a className={cls} href="#contact">{content.cta.label}</a>
}

export function PhoneLink({ content }: { content: SiteContent }) {
  if (!content.phone) return null
  return <a className="le-tel" href={telHref(content.phone)}>{content.phone}</a>
}

/**
 * The site header.
 *
 * Its absence was a large part of what read as unfinished — a page with no header does not look
 * like a website. The phone is reachable without scrolling at every viewport, because on a
 * lead-generation site that is the conversion path; the CTA button drops on mobile so the number
 * never has to.
 */
export function SiteHeader({ content, logoUrl }: { content: SiteContent; logoUrl?: string }) {
  return (
    <header className="le-header">
      <div className="le-wrap le-header-inner">
        {logoUrl
          ? <img className="le-header-logo" src={logoUrl} alt={content.businessName} />
          : <a className="le-header-name" href="#top">{content.businessName}</a>}
        <div className="le-header-actions">
          <PhoneLink content={content} />
          <CtaButton content={content} small />
        </div>
      </div>
    </header>
  )
}

/**
 * Hero — split anchor. Text in columns 1–6, image 7–12 bleeding to the right viewport edge.
 *
 * The headline is capped at 13ch on purpose: the two-or-three line wrap is what gives it presence.
 * A single long line at the same font size reads as a caption.
 */
export function HeroSplit({
  content, photo, eyebrow,
}: { content: SiteContent; photo?: SitePhoto; eyebrow?: string }) {
  // With no photo there is no right half to fill, and a half-width text column beside nothing is
  // exactly the dead space this pass exists to remove. Fall back to the editorial hero.
  if (!photo) return <HeroEditorial content={content} eyebrow={eyebrow} />

  return (
    <header className="le-hero" id="top">
      <div className="le-hero-inner">
        <div className="le-hero-text">
          {eyebrow ? <p className="le-eyebrow">{eyebrow}</p> : null}
          <h1 className="le-h1">{content.businessName}</h1>
          {heroLede(content) ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{heroLede(content)}</p> : null}
          <div className="le-actions">
            <CtaButton content={content} />
            {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
          </div>
        </div>
        <div className="le-hero-media">
          {/* Eager and unlazy — this is the LCP element. */}
          <img src={photo.url} alt={photo.caption ?? `Work by ${content.businessName}`} />
        </div>
      </div>
    </header>
  )
}

/** Hero with no image: an editorial stack widened to eight columns so nothing sits beside a void. */
export function HeroEditorial({ content, eyebrow }: { content: SiteContent; eyebrow?: string }) {
  // The proof bar refuses to render below two facts. Without this the single fact a thin site does
  // have — usually its service area — would disappear from the page altogether, and local intent
  // belongs in the first viewport.
  const strandedFacts = proofBarRenders(content) ? [] : proofFacts(content)
  return (
    <header className="le-hero" id="top">
      <div className="le-wrap">
        <div className="le-grid">
          <div className="le-c1-8 le-hero-text">
            {eyebrow ? <p className="le-eyebrow">{eyebrow}</p> : null}
            <h1 className="le-h1">{content.businessName}</h1>
            {heroLede(content) ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{heroLede(content)}</p> : null}
            <div className="le-actions">
              <CtaButton content={content} />
              {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
            </div>
            {strandedFacts.length ? (
              <p className="le-hero-fact">
                {strandedFacts.map(([label, value]) => `${label}: ${value}`).join('  ·  ')}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * Proof bar — full container width, equal columns.
 *
 * The column count reduces to the number of facts rather than rendering an empty cell, which is
 * what an unanswered credentials question used to produce.
 */
export function ProofBar({ content, showAreas = true }: { content: SiteContent; showAreas?: boolean }) {
  // One fact is not a bar. A single cell spanning the full width between two rules is what made
  // review-sparse read as broken; the hero carries a lone fact instead.
  if (!proofBarRenders(content, { showAreas })) return null
  const facts = proofFacts(content, { showAreas })

  return (
    <dl className={`le-proof le-proof-${Math.min(facts.length, 4)}`}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Services.
 *
 * Two layouts, chosen by `servicesLayout()`: an alternating image ladder for a short list with
 * photos to fill it, and a two-column list otherwise. The list's columns are explicitly `1fr 1fr` —
 * letting content size them is what produced the uneven cells in Chunk A.
 */
export function Services({
  content, photos = [], layout, eyebrow = 'What we do', heading = 'Services',
}: {
  content: SiteContent
  photos?: SitePhoto[]
  layout: 'ladder' | 'list'
  eyebrow?: string
  heading?: string
}) {
  const services = content.services
  if (!services?.length) return null

  return (
    <Section id="services" density="anchor">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow={eyebrow} heading={heading} /></div>
      </div>

      {layout === 'ladder' ? (
        <div>
          {services.map((s, i) => (
            <div className="le-grid le-ladder-row" key={s.name}>
              {photos[i] ? (
                <div className="le-ladder-img">
                  <img src={photos[i].url} alt={photos[i].caption ?? s.name} loading="lazy" />
                </div>
              ) : null}
              <div className="le-ladder-txt">
                <h3 className="le-h3">{s.name}</h3>
                {s.description ? <p>{s.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="le-svc-list" style={{ gridTemplateColumns: servicesColumns(services.length) === 1 ? '1fr' : '1fr 1fr' }}>
          {services.map(s => (
            <div className="le-svc-item" key={s.name}>
              <h3 className="le-h3">{s.name}</h3>
              {s.description ? <p>{s.description}</p> : null}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/**
 * Why us — a sticky heading column and a list of differentiators.
 *
 * Items come from Q4 (what makes you different) and Q5 (guarantees and credentials), split on
 * sentence boundaries. Under three items it falls back to a single centred column: two columns
 * with one item in them is the void this section was built to remove.
 */
export function WhyUs({ content, band }: { content: SiteContent; band?: boolean }) {
  const items = whyUsItems(content)

  if (items.length === 0) return null

  if (items.length < 3) {
    return (
      <Section id="why" density="connector" band={band}>
        <div className="le-why-single">
          <p className="le-eyebrow">Why us</p>
          <h2 className="le-h2">Why {content.businessName}</h2>
          {items.map(t => <p className="le-p" key={t} style={{ margin: '0 auto 16px' }}>{t}</p>)}
        </div>
      </Section>
    )
  }

  return (
    <Section id="why" density="anchor" band={band}>
      <div className="le-grid">
        <div className="le-why-head">
          <p className="le-eyebrow">Why us</p>
          <h2 className="le-h2">Why {content.businessName}</h2>
        </div>
        <div className="le-why-items">
          {items.map((text, i) => (
            <div className="le-why-item" key={text}>
              <h3 className="le-h3">{['Our promise', 'What you get', 'How we work', 'Peace of mind'][i]}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

/**
 * Gallery — six at most, at fixed aspect ratios.
 *
 * Row one is a 3:2 feature plus two stacked 4:3; row two is three equal 4:3. Fewer than four
 * photos drops row one entirely rather than leaving a half-built feature row. Twelve photos at
 * mismatched ratios was eating 40% of page height and is the largest element with the least to say.
 */
export function Gallery({
  photos, eyebrow = 'Our work', heading = 'Recent work',
}: { photos: SitePhoto[]; eyebrow?: string; heading?: string }) {
  const layout = galleryLayout(photos)
  if (!layout) return null

  return (
    <Section id="work" density="anchor">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow={eyebrow} heading={heading} /></div>
      </div>
      <div className="le-gal">
        {layout.feature ? (
          <figure className="le-gal-feature" style={{ margin: 0 }}>
            <img src={layout.feature.url} alt={layout.feature.caption ?? ''} loading="lazy" />
          </figure>
        ) : null}
        {layout.stack.length ? (
          <div className="le-gal-stack">
            {layout.stack.map(p => (
              <figure key={p.id} style={{ margin: 0 }}>
                <img src={p.url} alt={p.caption ?? ''} loading="lazy" />
              </figure>
            ))}
          </div>
        ) : null}
        {/* Span computed from what is LEFT, not assumed. The allocator spends photos on the hero
            and the band first, so the bottom row routinely holds two rather than three — and a
            fixed three-up rendering two left the right third of the grid empty. */}
        {layout.rest.map(p => (
          <figure className="le-gal-rest" key={p.id} style={{ margin: 0, gridColumn: `span ${layout.restSpan}` }}>
            <img src={p.url} alt={p.caption ?? ''} loading="lazy" />
          </figure>
        ))}
      </div>
    </Section>
  )
}

/**
 * Coverage — a city grid rather than one line of prose. Density, and local search value.
 *
 * Below three cities it does not render: a 4-column grid holding one item is the void the
 * three-content-elements rule exists to remove, and the proof bar carries the areas instead.
 */
export function Coverage({ content }: { content: SiteContent }) {
  const areas = content.serviceAreas
  if (!coverageRenders(content)) return null
  const shown = areas!.slice(0, 16)

  return (
    <Section id="coverage" density="connector">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow="Where we work" heading="Areas we serve" /></div>
      </div>
      <ul className="le-cover" style={{ margin: 0, padding: 0, gridTemplateColumns: `repeat(${coverageColumns(shown.length)}, 1fr)` }}>
        {shown.map(city => <li key={city}>{city}</li>)}
      </ul>
      {areas!.length > shown.length ? <p className="le-cover-note">and surrounding areas.</p> : null}
    </Section>
  )
}

/**
 * Trust — real quotes only.
 *
 * No stars, no avatar circles, no quotation-mark ornaments: each is a graphic standing in for
 * credibility rather than carrying it. Renders nothing when there are no testimonials, and never
 * invents one — a fabricated review is the single worst thing this product could publish.
 */
export function Trust({ testimonials }: { testimonials?: Testimonial[] }) {
  if (!testimonials?.length) return null
  const three = testimonials.length >= 3

  return (
    <Section id="trust" density="anchor">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow="What clients say" heading="In their words" /></div>
      </div>
      <div className="le-grid" style={{ rowGap: 48 }}>
        {testimonials.slice(0, 3).map((t, i) => (
          <blockquote
            className="le-quote"
            key={t.name + i}
            style={{ margin: 0, gridColumn: three ? 'span 4' : i === 0 ? '1 / 6' : '7 / 12' }}
          >
            <p>{t.quote}</p>
            <footer>{[t.name, t.city, t.jobType].filter(Boolean).join(' · ')}</footer>
          </blockquote>
        ))}
      </div>
    </Section>
  )
}

/**
 * FAQ — eight columns, not full width: a 90-character answer line is genuinely harder to read.
 *
 * `<details>` rather than JavaScript, and the +/- indicator is drawn in text rather than pulled
 * from an icon library.
 */
export function Faq({ faqs }: { faqs?: FaqItem[] }) {
  if (!faqs?.length) return null
  return (
    <Section id="faq" density="connector">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow="Before you call" heading="Common questions" /></div>
      </div>
      <div className="le-grid">
        <div className="le-faq">
          {faqs.slice(0, 6).map(f => (
            <details key={f.question}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

/**
 * Terminal CTA — two columns on a full-bleed band.
 *
 * The form sat narrow and alone on the left in Chunk A with the right half empty. Heading, a
 * sentence and the phone now occupy columns 1–5, the form 7–12.
 */
export function Contact({ content, children }: { content: SiteContent; children?: ReactNode }) {
  // A form CTA scrolls here, so repeating its label confirms arrival. A `call` CTA dials and never
  // lands here, so reusing its label would print the same words twice on one page.
  const heading = content.cta.kind === 'form' ? content.cta.label : 'Send us a message'
  return (
    <section id="contact" className="le-band le-cta-band">
      <div className="le-wrap">
        <div className="le-grid">
          <div className="le-cta-left">
            <p className="le-eyebrow">Get in touch</p>
            <h2 className="le-h2">{heading}</h2>
            <p className="le-p" style={{ opacity: 0.85 }}>
              Tell us what you need and {content.businessName} will get back to you.
            </p>
            {content.phone ? <div style={{ marginTop: 24 }}><PhoneLink content={content} /></div> : null}
          </div>
          <div className="le-cta-right">{children}</div>
        </div>
      </div>
    </section>
  )
}

export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="le-foot">
      <div className="le-wrap">
        <strong>{content.businessName}</strong>
        {content.phone ? <> · <a className="le-tel" href={telHref(content.phone)}>{content.phone}</a></> : null}
        {content.googleProfileUrl ? (
          <> · <a href={content.googleProfileUrl} rel="noopener noreferrer" target="_blank">Google Business Profile</a></>
        ) : null}
        <p className="le-credit">Site by 369 Agentic Systems</p>
      </div>
    </footer>
  )
}

/**
 * The Phase 4 lead form, still inert.
 *
 * Full width of its column now rather than a narrow card, and styled for the dark band it sits on.
 * It cannot be submitted: a form that looked live and dropped what a visitor typed would lose
 * exactly the lead this product is sold to capture, and nobody would ever know.
 */
export function LeadFormPlaceholder() {
  return (
    <div aria-hidden="true">
      <p className="le-eyebrow" style={{ marginBottom: 20 }}>Lead form — activates in Phase 4</p>
      {['Your name', 'Phone', 'Email', 'How can we help?'].map(label => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div className="le-field-label">{label}</div>
          <div className="le-field" style={{ height: label.startsWith('How') ? 96 : 52 }} />
        </div>
      ))}
      <div className="le-submit" style={{ opacity: 0.55 }}>Send</div>
    </div>
  )
}

/** Full-bleed photo band — Ironclad's signature, breaking the container edge to edge. */
export function PhotoBand({ photo, businessName }: { photo?: SitePhoto; businessName: string }) {
  if (!photo) return null
  return (
    <div className="le-bleed-out" style={{ height: 'clamp(320px, 44vw, 560px)', overflow: 'hidden' }}>
      <img
        src={photo.url}
        alt={photo.caption ?? `Work by ${businessName}`}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

/** Re-exported so templates import their services layout decision from one place. */
export type { ServiceItem }
