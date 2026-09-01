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
import { mosaicPlan } from '@/lib/lead-engine/photos'
import {
  accessBarRenders, accessFacts, coverageColumns, coverageRenders, editorialHeroFacts, galleryLayout, heroHeadline, heroLede, newPatientRenders, proofBarRenders, proofFacts, serviceDisplayName, servicesColumns, teamColumns, teamRenders, whyUsItems,
} from '@/lib/lead-engine/sections'
import type { ProofFact } from '@/lib/lead-engine/sections'

export {
  accessBarRenders, coverageRenders, editorialHeroFacts, proofBarRenders,
} from '@/lib/lead-engine/sections'

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
  // `data-theme` is the only per-KIT hook in the stylesheet, and it stays that way deliberately.
  // Everything a theme decides is a token; this attribute exists for the handful of STRUCTURAL
  // reversals a kit is allowed to make — today, Forge's dark chrome and full-bleed hero. A rule
  // keyed on it is a design decision no token can express, not a shortcut past the token layer.
  return (
    <div
      className={`le-site${fontClass ? ` ${fontClass}` : ''}`}
      data-accent-mode={accentMode}
      data-density={density}
      data-theme={theme}
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
  .le-grid, .le-hero-inner, .le-proof, .le-svc-list, .le-cover, .le-team, .le-hero-facts,
  .le-gal, .le-gal-stack, .le-header-inner, .le-header-actions, .le-actions, .le-faq
) > * { min-width: 0; }
.le-site :focus-visible { outline: 2px solid var(--le-accent-text); outline-offset: 2px; }

/* ── Grid: 12 columns, 1280 container, 32px gutter ─────────────────────────── */
.le-wrap { max-width: 1280px; margin: 0 auto; padding: 0 48px; }
.le-grid { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 32px; }
.le-c1-5  { grid-column: 1 / 6;  }
.le-c1-6  { grid-column: 1 / 7;  }
.le-c1-7  { grid-column: 1 / 8;  }
.le-c1-8  { grid-column: 1 / 9;  }
.le-c7-12 { grid-column: 7 / 13; }
.le-c8-12 { grid-column: 8 / 13; }
.le-c9-12 { grid-column: 9 / 13; }
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
/* Every hairline in this file is drawn with var(--le-edge), a tone built to sit on --le-paper. On
   --le-structure (a dark tone in every kit) that same hairline is nearly invisible. Rather than
   writing a --le-band-specific override for every rule that draws one, redefine the CUSTOM
   PROPERTY itself inside .le-band — every descendant that reads var(--le-edge) picks up this value
   through the ordinary CSS cascade, with no per-selector duplication. Same technique, same 20%
   figure, already proven on .le-field's border on the terminal CTA band. */
.le-band { --le-edge: color-mix(in oklab, var(--le-paper) 20%, transparent); }

.le-eyebrow {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility);
  font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking);
  text-transform: var(--le-utility-transform);
  /* --le-accent-text, never --le-accent-derived. The derived value is corrected for use as a FILL
     and equals the accent in surface_only mode, so four kits painted this eyebrow below 4.5:1 on
     their own paper — Yard at 1.97. See accentTextFor in theme.ts. Every rule in this file that
     paints TEXT in the accent reads this token; the two fill rules keep the other one. */
  color: var(--le-accent-text);
  margin: 0 0 24px;
}

.le-h1, .le-h2, .le-h3 {
  font-family: var(--le-font-display), var(--le-font-display-fallback);
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
  color: var(--le-accent-text); text-decoration: none;
  font-size: var(--le-display-m); font-weight: 600;
  font-family: var(--le-font-display), var(--le-font-display-fallback);
}
.le-tel:hover { text-decoration: underline; }
.le-band .le-tel { color: var(--le-paper); }

.le-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; margin-top: 40px; }

/* -- Site header ------------------------------------------------------------ */
/* The height is a VARIABLE because two unrelated things must agree on it: the header
   itself, and the scroll offset every in-page anchor needs to clear it. Written twice
   as a literal, they drift the first time anyone adjusts the header -- the derived-value
   trap this repo already has a lesson for. Redefined once at the mobile breakpoint,
   where both follow automatically. */
.le-site { --le-header-h: 72px; }
.le-header {
  position: sticky; top: 0; z-index: 50; height: var(--le-header-h);
  background: var(--le-paper); border-bottom: 1px solid var(--le-edge);
  backdrop-filter: blur(8px);
}
.le-header-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: var(--le-header-h); gap: 24px;
}

/* Anchors clear the sticky header.
   NOT a bug fix, and the first version of this comment wrongly said it was. Measured:
   with no scroll-margin the HEADINGS already cleared the bar, because a section's top
   padding (140px at #contact, 173px at #services) is larger than the 72px header. What
   does slide under is the section's own top EDGE, which is visible on a banded section
   as its colour block starting behind the bar.
   It is kept for the narrower reason: without it the anchor is correct only by accident,
   depending on section padding staying larger than the header. Both numbers move --
   padding shrinks at the mobile breakpoint already -- and nothing connects them. This
   makes the offset follow the header instead of hoping.
   Applied to every id rather than the two that are linked today (#contact from every CTA,
   #top from the wordmark): the rest carry ids for deep links and future nav. */
.le-site [id] { scroll-margin-top: calc(var(--le-header-h) + 16px); }
.le-header-name {
  font-family: var(--le-font-display), var(--le-font-display-fallback);
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

   THIS CALC IS SCOPED TO .le-hero-inner .le-hero-text — the split-anchor hero only. It used to sit
   on the bare .le-hero-text class, which HeroEditorial's text block also carries. Editorial has no
   viewport-bleeding image and already sits inside .le-wrap (a real 1280px-capped, 48px-padded
   container) — so the calc was a SECOND, additive left inset on top of one it already had, growing
   without bound as the viewport widened (368px at 1920px). On the centred variant, whose own box is
   a fixed ~623px (68ch, computed against the BODY font-size, so it does not grow with the hero's
   type scale), that padding ate so much of the box that "Plumbing" no longer fit on a line and
   overflow-wrap broke it mid-word — "Bell / Avenue / Plumbin / g" on review-sparse at wide desktop
   widths. Verified by sweeping viewport width and measuring the headline's own rendered box: it
   NARROWED as the viewport grew past ~1280px, which is backwards, and is only possible when an
   unbounded left inset is consuming a fixed-width box faster than the box itself can offer room.
*/
.le-hero { position: relative; }
.le-hero-inner { display: grid; grid-template-columns: 1fr 1fr; align-items: center; }
.le-hero-text { padding-top: 96px; padding-bottom: 96px; }
.le-hero-inner .le-hero-text {
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

/* The editorial hero's right-hand columns. Without these the block sat in 1-8 and 9-12 was empty,
   which is four dead columns and half the first viewport on Counsel and Ledger. */
/* padding-bottom matches .le-hero-text's, and is load-bearing rather than cosmetic. The facts are
   a sibling grid item with align-self:end, so their bottom edge pins to the ROW's bottom -- and the
   row is as tall as the text column INCLUDING its 96px of bottom padding. Without a matching pad
   the last fact's baseline lands flush on the hero's bottom edge while the headline column stops
   96px short, which reads as a broken section boundary rather than as a design. */
.le-hero-facts {
  margin: 0; align-self: end; display: grid; row-gap: 28px;
  border-left: 1px solid var(--le-edge); padding-left: 32px; padding-bottom: 96px;
}
.le-hero-facts dt {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.6; margin: 0 0 6px;
}
.le-hero-facts dd {
  margin: 0; font-family: var(--le-font-display), var(--le-font-display-fallback);
  font-size: var(--le-display-m); font-weight: 600; line-height: 1.3;
}
/* With no facts to sit beside it the block centres instead, so the margin is balanced rather than
   all on the right. 68ch is a measure, not a width in px, so it scales with the theme's type. */
.le-hero-centred { max-width: 68ch; margin-inline: auto; }

/* The editorial hero's ONE photograph, columns 8-12. Taller than it is wide on purpose: this is a
   portrait slot, and allocatePhotos already hands the hero the least-wide photo in the pool for
   exactly that reason. */
.le-hero-portrait { min-height: 440px; align-self: stretch; }
.le-hero-portrait img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  border-radius: var(--le-radius-image);
}
/* With the photograph in 8-12 the facts have nowhere to stack, so they draw as a hairline row
   under the hero instead — the same .le-proof treatment, still inside the header element. */
.le-hero-factrow { margin-top: 8px; }

/* ── Proof bar ─────────────────────────────────────────────────────────────── */
.le-proof {
  border-top: 1px solid var(--le-edge); border-bottom: 1px solid var(--le-edge);
  padding: 40px 0; display: grid; column-gap: 32px; row-gap: 24px;
}
/* At 4 facts, 1fr tracks are the right call — four roughly-equal short answers genuinely want to
   spread across the full bar. Below 4, 1fr still stretched each track to fill the same width, so
   two short facts (a number, a one-word label) sat flush left with a wide run of nothing to their
   right — the same "content doesn't fill its slot" failure the hero fix solved, in a bar rather
   than a grid cell. Content-sized columns, centred as a group, is what the fix brief's second
   option ("the items should center in the available width") means literally: the CLUSTER centres,
   rather than being stretched to a width its content never asked for. */
.le-proof-4 { grid-template-columns: repeat(4, 1fr); }
.le-proof-3 { grid-template-columns: repeat(3, max-content); justify-content: center; }
.le-proof-2 { grid-template-columns: repeat(2, max-content); justify-content: center; }
.le-proof-1 { grid-template-columns: max-content; justify-content: center; }
.le-proof dt {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.6; margin: 0 0 8px;
}
.le-proof dd {
  margin: 0; font-size: var(--le-display-m); font-weight: 600;
  font-family: var(--le-font-display), var(--le-font-display-fallback); line-height: 1.25;
  /* A cap, not a fit: with content-sized columns below 4 facts, an unbounded "Serving: Fort Worth
     · Arlington · Keller" would stretch its own track far past a short neighbouring fact like "12
     years", undoing the centring by making the row lopsided again. */
  max-width: 28ch;
}

/* ── Practice: access bar, team, new patients ──────────────────────────────── */

/* Sits on a band, so it needs no rules of its own — two hairlines on a tinted panel is one edge
   too many. The dd drops to body size because these are sentences, not numbers. */
.le-access { border-top: 0; border-bottom: 0; padding: 8px 0; }
.le-access dd { font-size: var(--le-body-l); font-weight: 500; line-height: 1.4; }
/* The one fact a patient scans for. The accent draws the eye to it in both directions — a clear
   "not right now" is as useful to read as a yes. */
.le-access div[data-open] dd { color: var(--le-accent-text); }

.le-team { display: grid; column-gap: 32px; row-gap: 48px; list-style: none; }
.le-team li { border-top: 1px solid var(--le-edge); padding-top: 20px; }
.le-team-role {
  margin: 6px 0 12px; font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.65;
}
.le-team li p:last-child { margin: 0; opacity: 0.85; }

.le-bring { margin: 16px 0 0; padding: 0; list-style: none; }
.le-bring li { border-bottom: 1px solid var(--le-edge); padding: 14px 0; }
.le-bring li:last-child { border-bottom: 0; }

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

/* The footer note -- a professional disclaimer or a licence number. Set narrow and quiet:
   it is required text, not a claim the business is making for itself. */
.le-foot-note {
  margin: 16px 0 0; max-width: 68ch;
  font-size: var(--le-body); line-height: var(--le-body-line); opacity: 0.72;
}

/* -- Services mosaic ------------------------------------------------------- */
/* Three columns; mosaicSpans guarantees every row fills, so there is never a
   trailing half-empty row. Kit-agnostic by construction: every colour, radius and
   shadow here comes from a token, so the mosaic looks native on any theme rather
   than being a Forge-only layout. NB: this block is a template literal -- no
   backticks in these comments. */
.le-mosaic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 44px; }
.le-tile {
  position: relative; overflow: hidden; min-height: 260px;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 26px; border-radius: var(--le-radius-card);
}
.le-tile-wide { grid-column: span 2; }
.le-tile-img { position: absolute; inset: 0; z-index: 0; }
.le-tile-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.le-tile-scrim {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0.08) 100%);
}
.le-tile-txt { position: relative; z-index: 2; }
/* A tile carrying a photograph sits on its own scrim, so its text is always light
   regardless of the kit's ink colour. */
.le-tile:not(.le-tile-accent):not(.le-tile-structure) .le-tile-txt,
.le-tile:not(.le-tile-accent):not(.le-tile-structure) .le-tile-txt .le-h3 { color: var(--le-paper); }
.le-tile-txt p { margin: 8px 0 0; font-size: var(--le-body); line-height: var(--le-body-line); }

/* The colour tiles. A service with no usable photograph becomes a deliberate block
   rather than a hole -- the whole reason the mosaic needs fewer photos than the ladder. */
.le-tile-accent { background: var(--le-accent); }
.le-tile-accent .le-tile-txt, .le-tile-accent .le-tile-txt .le-h3 { color: var(--le-paper); }
.le-tile-structure { background: var(--le-structure); }
.le-tile-structure .le-tile-txt, .le-tile-structure .le-tile-txt .le-h3 { color: var(--le-paper); }

/* Three columns, then straight to one -- there is deliberately NO two-column state.
   A 2-column grid can only fill perfectly when the service count is even, so at 3 or 5
   services it strands a half row; and with the span table's wide tiles it stranded one
   at SIX services too, measured at 700-900px as rows of 100%, 49%, 100%, 49%. Three
   columns fills exactly for every count the mosaic accepts (3-6), and one column
   trivially does. Anything between is a layout that only sometimes works. */
@media (max-width: 780px) {
  .le-mosaic { grid-template-columns: 1fr; gap: 14px; }
  .le-tile, .le-tile-wide { grid-column: span 1; min-height: 220px; }
}

/* ── Why us ────────────────────────────────────────────────────────────────── */
/* The sticky-heading three-column grid (.le-why-head / .le-why-items / .le-why-item) was removed
   with the markup it styled: whyUsItems returns at most two items now that Q4a is the hero's
   lede, so that layout could no longer be reached. The compact shape below is the only one.
   NB: this block is a template literal — no backticks in these comments. */
.le-why-single { max-width: 62ch; margin: 0 auto; text-align: center; }
/* Its own rhythm tier, not the standard connector's 64px — reuses the connector's own MOBILE
   value as a smaller desktop one rather than inventing a new spacing number. One or two sentences
   inside 64px of padding is what read as empty; this section is sized to what it actually holds. */
.le-why-compact { padding: var(--le-space-connector-m) 0; }
/* The pull quote. Display-l — the same size as the three-item layout's OWN heading — carries the
   section's full visual weight now that there is no heading competing with it. No quotation marks:
   this is the business's own claim about itself, not a customer's words, and Trust sits close
   enough on the page that a literal quote here would misread as a second set of testimonials. */
.le-why-quote {
  margin: 0; font-family: var(--le-font-display), var(--le-font-display-fallback);
  font-size: var(--le-display-m); font-weight: var(--le-display-weight);
  letter-spacing: var(--le-display-tracking); line-height: 1.3;
}
/* A caption, not a peer paragraph — set close beneath the quote so it reads as belonging to it. */
.le-why-caption {
  margin: 20px 0 0; font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-body); opacity: 0.65;
}

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
  font-family: var(--le-font-display), var(--le-font-display-fallback);
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
  display: block; width: 100%; box-sizing: border-box;
  background: color-mix(in oklab, var(--le-paper) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--le-paper) 20%, transparent);
  border-radius: var(--le-radius-card);
  color: var(--le-paper);
  padding: 14px 16px; min-height: 52px;
  font-family: var(--le-font-body), system-ui, sans-serif;
  font-size: var(--le-body);
}
textarea.le-field { min-height: 96px; resize: vertical; }
.le-field::placeholder { color: color-mix(in oklab, var(--le-paper) 55%, transparent); }
.le-field:focus {
  outline: none; border-color: color-mix(in oklab, var(--le-paper) 45%, transparent);
}
.le-submit {
  display: flex; align-items: center; justify-content: center; width: 100%;
  border: none; cursor: pointer;
  /* Paper label by default, matching .le-btn. Ink on a text_safe accent (Counsel's aged brass, for
     instance) is dark-on-dark — the per-mode rules above are what change it. */
  background: var(--le-accent); color: var(--le-paper);
  border-radius: var(--le-radius-button); min-height: 56px; padding: 18px 32px;
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-body); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
}
.le-submit:disabled { opacity: 0.6; cursor: default; }
/* Honeypot — off canvas rather than display:none, which some bots specifically check for and skip. */
.le-hp { position: absolute; left: -9999px; top: -9999px; height: 0; width: 0; overflow: hidden; }
.le-form-error {
  margin: 0 0 16px; font-size: var(--le-utility); color: var(--le-danger);
}
.le-form-success { text-align: left; }
.le-form-success .le-eyebrow { margin-bottom: 12px; }

/* ── Footer ────────────────────────────────────────────────────────────────── */
.le-foot { border-top: 1px solid var(--le-edge); padding: 40px 0 56px; }
.le-foot a {
  color: var(--le-accent-text); display: inline-block;
  padding: 13px 8px; margin: -13px -8px; min-height: 44px;
}
.le-foot .le-tel { font-size: var(--le-body); font-family: var(--le-font-body), system-ui, sans-serif; }
.le-credit { margin-top: 20px; font-size: var(--le-utility); opacity: 0.6; }

/* ── Tablet ────────────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .le-wrap { padding: 0 24px; }
  .le-cover { grid-template-columns: repeat(3, 1fr); }
}

/* ── Forge: the one kit allowed a structural reversal ──────────────────────────
   Everything above is kit-agnostic and driven by tokens. This block is not, and it is the only
   block in the file that is not — see ThemeShell's note on data-theme.

   Forge is the trades-and-yards kit, and what makes it read as a real commercial site rather than
   a template is chrome, not palette: a dark sticky bar, a hero photograph that fills the viewport
   under a scrim instead of sitting beside the text, and a proof bar in the accent. None of those
   three is expressible as a token value, because each one changes which element paints which
   surface. A palette swap alone leaves the page in exactly the shape that read as generic.

   No hex literals here either. Every tone is derived from --le-structure and --le-paper with
   color-mix, the same technique .le-band already uses to rebuild --le-edge on a dark ground. */

.le-site[data-theme="forge"] .le-header {
  background: var(--le-structure);
  border-bottom-color: color-mix(in oklab, var(--le-paper) 14%, transparent);
}
.le-site[data-theme="forge"] .le-header-name,
.le-site[data-theme="forge"] .le-header .le-tel { color: var(--le-paper); }

/* The split-anchor hero becomes a full-bleed one. The DOM is unchanged: .le-hero-media is lifted
   out of the grid to fill the header, a scrim goes over it, and the text rides on top — so a site
   with no photo still falls back to HeroEditorial exactly as before, and nothing about the
   zero-photo guarantee moves. */
.le-site[data-theme="forge"] .le-hero { isolation: isolate; background: var(--le-structure); }
.le-site[data-theme="forge"] .le-hero-inner { grid-template-columns: 1fr; }
.le-site[data-theme="forge"] .le-hero-media {
  position: absolute; inset: 0; z-index: 0;
  /* height, not just min-height: the mobile rule below pins .le-hero-media to 320px, and an
     absolutely positioned box with top/bottom/height all set drops the bottom rather than the
     height. Both are released here so inset wins at every width. */
  min-height: 0; height: auto;
}
.le-site[data-theme="forge"] .le-hero::after {
  content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(
    105deg,
    color-mix(in oklab, var(--le-structure) 94%, transparent) 0%,
    color-mix(in oklab, var(--le-structure) 86%, transparent) 42%,
    color-mix(in oklab, var(--le-structure) 48%, transparent) 100%
  );
}
.le-site[data-theme="forge"] .le-hero-inner .le-hero-text {
  position: relative; z-index: 2; color: var(--le-paper);
  padding-top: 140px; padding-bottom: 140px;
  padding-right: max(48px, calc(50vw - 640px + 48px));
}
.le-site[data-theme="forge"] .le-hero-inner .le-hero-text .le-eyebrow { color: var(--le-paper); opacity: 0.78; }
.le-site[data-theme="forge"] .le-hero-inner .le-hero-text .le-tel { color: var(--le-paper); }

/* The proof bar in the accent — Forge's signature band, and the reason the class exists at all.
   The label colour is INK, not paper: this accent is surface_only on every kit that uses it, which
   is precisely the finding that says a paper label on this fill is unreadable. The mockup set it
   white; the mockup is wrong about that one value and the validator is right. */
.le-site[data-theme="forge"] .le-proof-band {
  background: var(--le-accent); color: var(--le-ink);
  --le-edge: color-mix(in oklab, var(--le-ink) 22%, transparent);
}
.le-site[data-theme="forge"] .le-proof-band .le-proof { border-top: 0; border-bottom: 0; }
.le-site[data-theme="forge"] .le-proof-band .le-proof dt { opacity: 0.72; }

/* The mobile rules below reset .le-hero-text's padding for the SPLIT hero, and the desktop Forge
   rule above outranks them on specificity, so Forge needs its own. Written here rather than inside
   the mobile block so the whole kit reads in one place. */
@media (max-width: 720px) {
  .le-site[data-theme="forge"] .le-hero-inner .le-hero-text {
    padding-top: 88px; padding-bottom: 88px; padding-left: 20px; padding-right: 20px;
  }
  /* The 105deg scrim reaches its transparent end at the right edge of a WIDE viewport. At 390px
     the whole hero sits in the opaque half of that gradient and the photograph is invisible —
     checked in a browser at 390px, not reasoned about. Vertical here instead: dark where the text
     is, clear at the top, so the photo is actually seen on the device most of these visitors use. */
  .le-site[data-theme="forge"] .le-hero::after {
    background: linear-gradient(
      to bottom,
      color-mix(in oklab, var(--le-structure) 52%, transparent) 0%,
      color-mix(in oklab, var(--le-structure) 82%, transparent) 46%,
      color-mix(in oklab, var(--le-structure) 94%, transparent) 100%
    );
  }
}

/* ── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .le-wrap { padding: 0 20px; }
  .le-grid { column-gap: 0; }
  .le-anchor    { padding: var(--le-space-anchor-m) 0; }
  .le-connector { padding: var(--le-space-connector-m) 0; }

  .le-c1-5, .le-c1-6, .le-c1-7, .le-c1-8, .le-c7-12, .le-c8-12, .le-c9-12, .le-c1-12,
  .le-ladder-img, .le-ladder-txt,
  .le-cta-left, .le-cta-right, .le-faq,
  .le-ladder-row:nth-child(even) .le-ladder-img,
  .le-ladder-row:nth-child(even) .le-ladder-txt { grid-column: 1 / -1; }

  .le-site { --le-header-h: 60px; }
  .le-header .le-btn { display: none; }

  /* Photo above the text on mobile, per the SKILL's split-anchor note. */
  .le-hero-inner { grid-template-columns: 1fr; }
  /* Split-only, same scoping fix as the desktop rule above. The split hero has no .le-wrap and
     needs its own 20px horizontal inset; the editorial hero already gets one from .le-wrap and
     does not need a second, smaller one stacked on top of it. */
  .le-hero-text { padding: 40px 0; }
  .le-hero-inner .le-hero-text { padding-left: 20px; padding-right: 20px; }
  .le-h1 { font-size: clamp(2.5rem, 9vw, 3.25rem); max-width: none; }
  .le-hero-media { grid-row: 1; min-height: 320px; height: 320px; }

  /* The desktop centred/content-sized treatment for 2-3 facts is a DESKTOP fix: max-content columns
     refuse to wrap, and "Licensed and insured in Texas" at display-m size computed to 398px wide —
     wider than the entire 320px viewport — the first time this was checked at a real mobile width.
     Reset every count back to a responsive, stretching, WRAPPING 2-up grid, same as it always was. */
  .le-proof-4, .le-proof-3, .le-proof-2 {
    grid-template-columns: repeat(2, 1fr); justify-content: stretch;
  }
  .le-proof dd { max-width: none; }
  .le-ladder-row { margin-bottom: 48px; }
  .le-ladder-row:nth-child(even) .le-ladder-img,
  .le-ladder-row:nth-child(even) .le-ladder-txt { grid-row: auto; }
  .le-svc-list { grid-template-columns: 1fr; row-gap: 32px; }

  .le-gal { grid-template-columns: repeat(2, 1fr); }
  .le-gal-feature { grid-column: 1 / -1; }
  .le-gal-stack   { grid-column: 1 / -1; grid-template-columns: repeat(2, 1fr); }
  .le-gal-rest    { grid-column: span 1 !important; }

  .le-cover { grid-template-columns: repeat(2, 1fr); }
  .le-team  { grid-template-columns: 1fr !important; row-gap: 32px; }
  /* The facts stack below the headline rather than beside it; the border moves to the top edge. */
  /* Same flush-edge fix as the desktop rule, at the mobile hero's own 40px rhythm: here the facts
     stack BELOW the text, so they are the last thing in the hero and their own bottom padding is
     the only thing separating them from the next section. */
  .le-hero-facts { border-left: 0; border-top: 1px solid var(--le-edge); padding: 32px 20px 40px; row-gap: 20px; }
  .le-hero-centred { max-width: none; }
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
}
`

// ── Primitives ───────────────────────────────────────────────────────────────

export function Section({
  id, density = 'anchor', band, className, children,
}: {
  id?: string
  density?: 'anchor' | 'connector'
  band?: boolean
  /** An escape hatch for a section whose rhythm is neither of the two standard tiers — see the
      Why-us single-item fallback, the one caller that currently needs it. */
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} className={[density === 'anchor' ? 'le-anchor' : 'le-connector', band ? 'le-band' : '', className ?? ''].join(' ').trim()}>
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
 * The one place every SitePhoto becomes an `<img>`. `docs/PHOTO-REQUIREMENTS.md` Part B §7.
 *
 * `srcSet`/`sizes` only appear when `photo.variants` exists — a photo uploaded before the Part B
 * pipeline shipped has none, and falls back to plain `src`, identical to how every photo on the
 * site rendered before this existed. `width`/`height` likewise only print when the pipeline
 * measured them; every slot already fixes its own box with CSS (`object-fit: cover` on a set
 * aspect-ratio), so these are belt-and-suspenders CLS prevention, not what actually sizes anything.
 */
function SitePhotoImg({
  photo, alt, sizes, loading = 'lazy', fetchPriority, className, style,
}: {
  photo: SitePhoto
  alt: string
  /** Required whenever `srcSet` will be present — a `srcSet` with no `sizes` degrades to the
   *  largest candidate on every browser, which defeats having variants at all. */
  sizes: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  className?: string
  style?: React.CSSProperties
}) {
  const srcSet = photo.variants?.length
    ? photo.variants.map(v => `${v.webp} ${v.width}w`).join(', ')
    : undefined

  return (
    <img
      src={photo.url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
      style={photo.dominantHex ? { background: photo.dominantHex, ...style } : style}
    />
  )
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
          <h1 className="le-h1">{heroHeadline(content)}</h1>
          {heroLede(content) ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{heroLede(content)}</p> : null}
          <div className="le-actions">
            <CtaButton content={content} />
            {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
          </div>
        </div>
        <div className="le-hero-media">
          {/* Eager and high-priority — this is the LCP element. Full width under the split
              breakpoint, half the viewport above it (text takes the other half). */}
          <SitePhotoImg
            photo={photo}
            alt={photo.caption ?? `Work by ${content.businessName}`}
            sizes="(max-width: 900px) 100vw, 50vw"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </header>
  )
}

/**
 * Hero with no image.
 *
 * Two shapes, and which one it takes is the fix for the dead right half. The block used to sit in
 * columns 1–8 with 9–12 empty — four dead columns on Counsel and Ledger, where half the first
 * viewport was blank.
 *
 * • **With facts**: text 1–7, the facts stacked in 9–12. The templates that pass facts here drop
 *   their proof bar, so this moves the content up rather than printing it twice.
 * • **Without**: the block centres at a 68ch measure, so the margin is balanced rather than all on
 *   one side. A single stranded fact still prints inline — local intent belongs above the fold, and
 *   on a thin site the proof bar refuses to render it.
 */
export function HeroEditorial({
  content, eyebrow, facts, photo,
}: { content: SiteContent; eyebrow?: string; facts?: ProofFact[]; photo?: SitePhoto }) {
  // Default preserves the split hero's fallback behaviour: the bar below still renders, so the hero
  // shows only what the bar refused.
  const carried = facts ?? (proofBarRenders(content) ? [] : proofFacts(content))
  // A photograph takes columns 8–12, so the facts cannot also stack there. They move to a hairline
  // row directly beneath, inside this same header — NOT to a section of its own. That distinction
  // is load-bearing: `heroCarriesProof(template)` is what tells `sectionCount` this template has no
  // proof section, and making that predicate depend on whether a photo exists would let the count
  // drift from what renders, which is the one thing its own doc says must not happen. The hero
  // still carries the proof; it just draws it as a row rather than as a column.
  const stacked = !photo && carried.length >= 2
  const rowed = photo ? carried : []
  const stranded = stacked || rowed.length ? [] : carried

  return (
    <header className="le-hero" id="top">
      <div className="le-wrap">
        <div className="le-grid">
          <div className={
            photo ? 'le-c1-7 le-hero-text'
              : stacked ? 'le-c1-7 le-hero-text'
                : 'le-c1-12 le-hero-text le-hero-centred'
          }>
            {eyebrow ? <p className="le-eyebrow">{eyebrow}</p> : null}
            <h1 className="le-h1">{heroHeadline(content)}</h1>
            {heroLede(content) ? <p className="le-p le-lede" style={{ marginTop: 24 }}>{heroLede(content)}</p> : null}
            <div className="le-actions">
              <CtaButton content={content} />
              {content.cta.kind === 'form' ? <PhoneLink content={content} /> : null}
            </div>
            {stranded.length ? (
              <p className="le-hero-fact">
                {stranded.map(([label, value]) => `${label}: ${value}`).join('  ·  ')}
              </p>
            ) : null}
          </div>

          {stacked ? (
            <dl className="le-c9-12 le-hero-facts">
              {carried.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* One photograph, and only one. "Must survive with zero photos" is why Service Clean is
              the universal fallback; it is not the same rule as "must never show photos", and the
              two had been collapsed into one. For a professional practice the photo IS the pitch —
              people hire a person. The gallery stays off (TEMPLATE_RENDERS_GALLERY.service_clean),
              because a wall of six office shots is the filler that reads as generated. */}
          {photo ? (
            <div className="le-c8-12 le-hero-portrait">
              <SitePhotoImg
                photo={photo}
                alt={photo.caption ?? content.businessName}
                sizes="(max-width: 900px) 100vw, 42vw"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          ) : null}
        </div>

        {rowed.length ? (
          <dl className={`le-proof le-proof-${Math.min(rowed.length, 4)} le-hero-factrow`}>
            {rowed.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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
  content, photos = [], layout, eyebrow = 'What we do', heading = 'Services', band,
}: {
  content: SiteContent
  photos?: SitePhoto[]
  layout: 'mosaic' | 'ladder' | 'list'
  eyebrow?: string
  heading?: string
  band?: boolean
}) {
  const services = content.services
  if (!services?.length) return null

  return (
    <Section id="services" density="anchor" band={band}>
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow={eyebrow} heading={heading} /></div>
      </div>

      {layout === 'mosaic' ? (
        <div className="le-mosaic">
          {mosaicPlan(services.length, photos.length).map((tile, i) => {
            const s = services[i]
            const photo = tile.photoIndex === null ? undefined : photos[tile.photoIndex]
            return (
              <div
                key={s.name}
                className={`le-tile${tile.span === 2 ? ' le-tile-wide' : ''}${tile.fill ? ` le-tile-${tile.fill}` : ''}`}
              >
                {photo ? (
                  <>
                    <div className="le-tile-img">
                      <SitePhotoImg
                        photo={photo}
                        alt={photo.caption ?? `${content.businessName} — ${serviceDisplayName(s.name)}`}
                        sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw"
                      />
                    </div>
                    {/* The scrim, not a text-shadow: a photograph can be light or dark anywhere,
                        and only an opaque gradient makes the label legible on both. */}
                    <div className="le-tile-scrim" />
                  </>
                ) : null}
                <div className="le-tile-txt">
                  <h3 className="le-h3">{serviceDisplayName(s.name)}</h3>
                  {s.description ? <p>{s.description}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : layout === 'ladder' ? (
        <div>
          {services.map((s, i) => (
            <div className="le-grid le-ladder-row" key={s.name}>
              {photos[i] ? (
                <div className="le-ladder-img">
                  <SitePhotoImg
                    photo={photos[i]}
                    alt={photos[i].caption ?? `${content.businessName} — ${serviceDisplayName(s.name)}`}
                    sizes="(max-width: 900px) 100vw, 50vw"
                  />
                </div>
              ) : null}
              <div className="le-ladder-txt">
                <h3 className="le-h3">{serviceDisplayName(s.name)}</h3>
                {s.description ? <p>{s.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="le-svc-list" style={{ gridTemplateColumns: servicesColumns(services.length) === 1 ? '1fr' : '1fr 1fr' }}>
          {services.map(s => (
            <div className="le-svc-item" key={s.name}>
              <h3 className="le-h3">{serviceDisplayName(s.name)}</h3>
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
 * Items are Q4a and Q4b (both guaranteed — see `whyUsItems`) plus, only when the business stated
 * one, a Q5 credential as a third item. Under three items it falls back to a single centred
 * column: two columns with one item in them is the void this section was built to remove.
 */
export function WhyUs({ content, band }: { content: SiteContent; band?: boolean }) {
  const items = whyUsItems(content)

  if (items.length === 0) return null

  // A section for one or two sentences is not a shrunken version of the section for three — it is
  // a different shape. The old version reused a multi-column layout's display-heading-plus-body
  // treatment and its 64px connector rhythm, and one or two short sentences inside that much
  // structure read as empty rather than deliberate, which is exactly what a customer with a terse
  // answer produces — not a rare fixture shape, the LIKELY one.
  //
  // This is now the ONLY shape. `whyUsItems` returns at most two (Q4b, then a Q5 credential)
  // since Q4a moved to the hero as its lede, so the three-column branch that used to live here
  // became unreachable and was removed rather than left as code no test could enter. It is in
  // git history if a third item is ever added.
  //
  // No "Why {business}" heading: the primary sentence carries the section's whole weight, set
  // large in the display face rather than body copy — a statement, not a quoted testimonial, so no
  // quotation marks, which would misread as a customer's words this close to Trust's real ones. A
  // second sentence sits close beneath as a caption rather than a peer paragraph.
  const [primary, caption] = items
  return (
    <Section id="why" density="connector" band={band} className="le-why-compact">
      <div className="le-why-single">
        <p className="le-eyebrow">Why us</p>
        <p className="le-why-quote">{primary}</p>
        {caption ? <p className="le-why-caption">{caption}</p> : null}
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
  photos, businessName, eyebrow = 'Our work', heading = 'Recent work', band,
}: { photos: SitePhoto[]; businessName?: string; eyebrow?: string; heading?: string; band?: boolean }) {
  const layout = galleryLayout(photos)
  if (!layout) return null
  // Part B §9: never empty, never a description of content we can't see. Not allocated to a
  // specific service row, so this is the "otherwise" branch — business name alone.
  const altFallback = businessName ?? 'Recent work'

  return (
    <Section id="work" density="anchor" band={band}>
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow={eyebrow} heading={heading} /></div>
      </div>
      <div className="le-gal">
        {layout.feature ? (
          <figure className="le-gal-feature" style={{ margin: 0 }}>
            <SitePhotoImg photo={layout.feature} alt={layout.feature.caption ?? altFallback} sizes="(max-width: 900px) 100vw, 50vw" />
          </figure>
        ) : null}
        {layout.stack.length ? (
          <div className="le-gal-stack">
            {layout.stack.map(p => (
              <figure key={p.id} style={{ margin: 0 }}>
                <SitePhotoImg photo={p} alt={p.caption ?? altFallback} sizes="(max-width: 900px) 50vw, 25vw" />
              </figure>
            ))}
          </div>
        ) : null}
        {/* Span computed from what is LEFT, not assumed. The allocator spends photos on the hero
            and the band first, so the bottom row routinely holds two rather than three — and a
            fixed three-up rendering two left the right third of the grid empty. */}
        {layout.rest.map(p => (
          <figure className="le-gal-rest" key={p.id} style={{ margin: 0, gridColumn: `span ${layout.restSpan}` }}>
            <SitePhotoImg photo={p} alt={p.caption ?? altFallback} sizes="(max-width: 900px) 100vw, 33vw" />
          </figure>
        ))}
      </div>
    </Section>
  )
}

/**
 * ── Practice only ────────────────────────────────────────────────────────────
 *
 * The access bar: whether the practice is taking new patients, which plans it accepts, when it is
 * open and where it is. These are the four things a patient checks before ringing, and they are the
 * reason Practice is a template rather than Service Clean in a calmer palette.
 *
 * Until the questionnaire asked for them none of this rendered, so the template was Service Clean
 * with the Clinic kit. It renders only what the practice actually answered — and "Not taking new
 * patients right now" renders too, because a patient who reads it and does not ring has been served
 * better than one who rings and is turned away.
 */
export function AccessBar({ content }: { content: SiteContent }) {
  if (!accessBarRenders(content)) return null
  const facts = accessFacts(content)
  const accepting = content.access?.acceptingNewPatients

  return (
    <Section id="access" density="connector" band>
      <dl className={`le-proof le-access le-proof-${Math.min(facts.length, 4)}`}>
        {facts.map(([label, value], i) => (
          <div key={label} {...(i === 0 && typeof accepting === 'boolean' ? { 'data-open': String(accepting) } : {})}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/**
 * Meet the team.
 *
 * No photographs: the questionnaire does not collect headshots, and a grey avatar circle where a
 * face should be is worse than a name set properly. Role is required — an unattributed list of
 * names does not tell a patient which one is the dentist.
 */
export function Team({ content }: { content: SiteContent }) {
  if (!teamRenders(content)) return null
  const team = content.team!

  return (
    <Section id="team" density="anchor">
      <div className="le-grid">
        <div className="le-c1-6"><SectionHead eyebrow="Who you will see" heading="Meet the team" /></div>
      </div>
      <ul className="le-team" style={{ margin: 0, padding: 0, gridTemplateColumns: `repeat(${teamColumns(team.length)}, 1fr)` }}>
        {team.map(m => (
          <li key={m.name}>
            <h3 className="le-h3">{m.name}</h3>
            <p className="le-team-role">{[m.role, m.credentials].filter(Boolean).join(' · ')}</p>
            {m.bio ? <p>{m.bio}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * New-patient information — what happens at a first visit, and what to bring.
 *
 * The one section on any template that reduces a specific anxiety rather than making a claim, which
 * is why it earns its place on a page a nervous patient is reading. Renders only above three
 * elements; below that the FAQ already covers it.
 */
export function NewPatientInfo({ content, band }: { content: SiteContent; band?: boolean }) {
  if (!newPatientRenders(content)) return null
  const info = content.newPatientInfo!

  return (
    <Section id="new-patients" density="anchor" band={band}>
      <div className="le-grid">
        <div className="le-c1-5">
          <SectionHead eyebrow="Your first visit" heading="New patients" />
          {info.formsUrl ? (
            <p style={{ marginTop: 24 }}>
              <a className="le-btn le-btn-sm" href={info.formsUrl} rel="noopener noreferrer" target="_blank">
                New patient forms
              </a>
            </p>
          ) : null}
        </div>
        <div className="le-c7-12">
          {info.firstVisit ? <p className="le-p">{info.firstVisit}</p> : null}
          {info.whatToBring?.length ? (
            <>
              <h3 className="le-h3" style={{ marginTop: 32 }}>What to bring</h3>
              <ul className="le-bring">
                {info.whatToBring.map(item => <li key={item}>{item}</li>)}
              </ul>
            </>
          ) : null}
        </div>
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
export function Coverage({ content, band }: { content: SiteContent; band?: boolean }) {
  const areas = content.serviceAreas
  if (!coverageRenders(content)) return null
  const shown = areas!.slice(0, 16)

  return (
    <Section id="coverage" density="connector" band={band}>
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
export function Trust({ testimonials, band }: { testimonials?: Testimonial[]; band?: boolean }) {
  if (!testimonials?.length) return null
  const three = testimonials.length >= 3

  return (
    <Section id="trust" density="anchor" band={band}>
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
        {/* Verbatim, never reformatted: it is either the business's own wording or a
            conventional disclaimer an operator confirmed, and neither is ours to edit. */}
        {content.footerNote ? <p className="le-foot-note">{content.footerNote}</p> : null}
        <p className="le-credit">Site by 369 Agentic Systems</p>
      </div>
    </footer>
  )
}

/** Full-bleed photo band — the trades kit's signature, breaking the container edge to edge. */
export function PhotoBand({ photo, businessName }: { photo?: SitePhoto; businessName: string }) {
  if (!photo) return null
  return (
    <div className="le-bleed-out" style={{ height: 'clamp(320px, 44vw, 560px)', overflow: 'hidden' }}>
      <SitePhotoImg
        photo={photo}
        alt={photo.caption ?? `Work by ${businessName}`}
        sizes="100vw"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

/** Re-exported so templates import their services layout decision from one place. */
export type { ServiceItem }
