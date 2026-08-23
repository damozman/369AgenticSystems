/**
 * The shared primitives all five Lead Engine templates are built from, plus the theme wrapper.
 *
 * The design reference is `.claude/skills/site-design-system/SKILL.md`. Its rules are not repeated
 * here — where a value looks arbitrary, that file is why.
 *
 * ── The hard rule this file exists to hold ──
 * No hex literal, no `font-family` with a literal value, no hardcoded radius or shadow anywhere in
 * this file or in any template. Every one comes from a `var(--le-*)` emitted by `tokensFor()`.
 * `scripts/verify-lead-engine.mjs` checks it mechanically, because `ignoreBuildErrors: true` means
 * nothing else will, and one stray `#0A0A0A` is how a themed system quietly stops being one.
 *
 * ── Why the sites opt out of the portal's CSS entirely ──
 * `app/globals.css` paints `body` with our dark admin theme on every Next-rendered route, and
 * `app/layout.tsx` toggles `html.light` from a `portal-theme` key in **the visitor's own
 * localStorage** — so a stranger reading a roofer's website would get our dark Command Center
 * palette, while someone who had used our portal would get a different page. That file also carries
 * a wall of `html.light .text-slate-400 { … !important }` rules that reach into any markup using
 * those class names. Hence: own class names, own tokens, nothing borrowed.
 */

import type { ReactNode } from 'react'
import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import type { Brand, Theme } from '@/lib/lead-engine/theme'
import { tokensFor } from '@/lib/lead-engine/theme'
import { telHref } from '@/lib/lead-engine/content'

/**
 * The one place a theme becomes CSS.
 *
 * Sets every token as an inline custom property on a single element; templates render inside it.
 * There are deliberately **no per-theme component variants** — one set of components, six token
 * sets. A per-theme variant is how six copies of a bug get born.
 */
export function ThemeShell({
  theme, brand, fontClass, children,
}: {
  theme: Theme
  brand?: Brand
  /** The next/font variable class for this theme's faces. Supplied by the route. */
  fontClass?: string
  children: ReactNode
}) {
  return (
    <div
      className={`le-site${fontClass ? ` ${fontClass}` : ''}`}
      style={tokensFor(theme, brand) as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      {children}
    </div>
  )
}

/**
 * Every rule is expressed in tokens. The only literals below are structural — grid counts,
 * percentages, `1px` hairlines and z-indexes — none of which is a design decision a theme owns.
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
}
.le-site *, .le-site *::before, .le-site *::after { box-sizing: border-box; }

/* Visible keyboard focus on everything interactive — quality gate, and free. */
.le-site :focus-visible {
  outline: 2px solid var(--le-accent-derived);
  outline-offset: 2px;
}

.le-wrap { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

/* Section rhythm. Anchors carry weight, connectors sit between them, and no more than two
   consecutive sections may sit on --le-paper — hence .le-band. */
.le-anchor    { padding: var(--le-space-anchor) 0; }
.le-connector { padding: var(--le-space-connector) 0; }
.le-band      { background: var(--le-structure); color: var(--le-paper); }
.le-band .le-eyebrow { color: var(--le-paper); opacity: 0.72; }
.le-band .le-p       { color: var(--le-paper); opacity: 0.88; }

.le-eyebrow {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility);
  font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking);
  text-transform: var(--le-utility-transform);
  color: var(--le-accent-derived);
  margin: 0 0 14px;
}

.le-h1, .le-h2, .le-h3 {
  font-family: var(--le-font-display), Georgia, serif;
  font-weight: var(--le-display-weight);
  letter-spacing: var(--le-display-tracking);
  margin: 0;
  line-height: 1.05;
}
.le-h1 { font-size: var(--le-display-xl); }
.le-h2 { font-size: var(--le-display-l); margin-bottom: 28px; }
.le-h3 { font-size: var(--le-display-m); line-height: 1.2; }

.le-p     { margin: 0 0 16px; max-width: 62ch; }
.le-lede  { font-size: var(--le-body-l); max-width: 54ch; }

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
/* Ink label on the fill wherever the accent is light — the surface_only case. Set per site by the
   route, never guessed here. */
.le-site[data-accent-mode="surface_only"] .le-btn,
.le-site[data-accent-mode="derived"] .le-btn { color: var(--le-ink); }

.le-btn-quiet {
  background: transparent; color: var(--le-accent-derived);
  border: 1px solid var(--le-accent-derived);
}
.le-site[data-accent-mode="surface_only"] .le-btn-quiet,
.le-site[data-accent-mode="derived"] .le-btn-quiet { color: var(--le-accent-derived); }

.le-tel {
  display: inline-flex; align-items: center; min-height: 44px;
  padding: 6px 10px; margin: -6px -10px;
  border-radius: var(--le-radius-button);
  color: var(--le-accent-derived); font-weight: 600; text-decoration: none;
  font-size: var(--le-body-l);
}
.le-tel:hover { text-decoration: underline; }
.le-band .le-tel { color: var(--le-paper); }

/* Services: an asymmetric ladder, never three equal cards in a row.
   The spans MUST tile exactly, or CSS grid leaves holes and the empty cells show this container's
   background as grey rectangles — which is what happened first time round, on every site. A
   4-item cycle of 4·2·2·4 sums to 6 twice, so every pair completes a row whatever the item count;
   an odd final item spans the full width rather than leaving half a row empty. */
.le-ladder { display: grid; gap: 1px; background: var(--le-edge); border-top: 1px solid var(--le-edge); }
.le-ladder > * {
  background: var(--le-paper); padding: 28px 24px;
  display: grid; grid-template-columns: 1fr; gap: 6px; align-content: start;
}
@media (min-width: 721px) {
  .le-ladder { grid-template-columns: repeat(6, 1fr); }
  .le-ladder > *:nth-child(4n+1) { grid-column: span 4; }
  .le-ladder > *:nth-child(4n+2) { grid-column: span 2; }
  .le-ladder > *:nth-child(4n+3) { grid-column: span 2; }
  .le-ladder > *:nth-child(4n+4) { grid-column: span 4; }
  .le-ladder > *:last-child:nth-child(odd) { grid-column: 1 / -1; }
}

.le-facts { display: flex; flex-wrap: wrap; gap: 20px 48px; }
.le-facts dt {
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
  opacity: 0.7; margin: 0 0 6px;
}
.le-facts dd { margin: 0; font-size: var(--le-body-l); font-weight: 600; }

.le-photo {
  width: 100%; height: 100%; object-fit: cover; display: block;
  border-radius: var(--le-radius-image); background: var(--le-edge);
}
.le-figure { margin: 0; }
.le-figure figcaption { font-size: var(--le-utility); opacity: 0.75; margin-top: 8px; }

/* Gallery: deliberately not a uniform 3-up, but it must still tile.
   Same 4·2·2·4 cycle as the ladder, and a FIXED row height rather than a per-item aspect ratio —
   with aspect-ratio, a wide item and a narrow item in the same row resolve to different heights,
   the row takes the taller, and the short one leaves a gap under it. Uniform rows with varied
   widths is what reads as designed; varied heights reads as broken. */
.le-gallery {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px;
  grid-auto-rows: clamp(200px, 22vw, 300px);
}
.le-gallery > *:nth-child(4n+1) { grid-column: span 4; }
.le-gallery > *:nth-child(4n+2) { grid-column: span 2; }
.le-gallery > *:nth-child(4n+3) { grid-column: span 2; }
.le-gallery > *:nth-child(4n+4) { grid-column: span 4; }
.le-gallery > *:last-child:nth-child(odd) { grid-column: 1 / -1; }

/* Full-bleed photo band — Ironclad's signature, available to any kit that asks for it. */
.le-bleed { width: 100%; height: clamp(280px, 42vw, 520px); overflow: hidden; }
.le-bleed img { width: 100%; height: 100%; object-fit: cover; display: block; }

.le-hero { padding: 96px 0 72px; }
.le-hero-split { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; }
.le-hero-media { height: clamp(320px, 40vw, 560px); }

.le-card {
  background: var(--le-paper); border: 1px solid var(--le-edge);
  border-radius: var(--le-radius-card); box-shadow: var(--le-shadow-card);
  padding: 24px;
}

/* The Phase 4 form stub, drawn as a wireframe rather than a filled card.
   It sits on the terminal CTA's --le-structure band, where a --le-paper card renders as a grey
   blob with its fields invisible inside it — it read as a broken image, not as a form. Everything
   here inherits currentColor, so it is legible on paper and on a band without knowing which. */
.le-formstub {
  max-width: 560px; border: 1px dashed currentColor; border-radius: var(--le-radius-card);
  padding: 24px; background: transparent;
}
.le-formstub .le-eyebrow { color: currentColor; opacity: 0.65; }
.le-formstub-label { font-size: var(--le-utility); font-weight: 600; margin-bottom: 6px; opacity: 0.8; }
.le-formstub-field {
  border: 1px solid currentColor; border-radius: var(--le-radius-card);
  background: transparent; opacity: 0.35;
}
.le-formstub-send {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid currentColor; border-radius: var(--le-radius-button);
  padding: 14px 28px; min-height: 48px; opacity: 0.5;
  font-family: var(--le-font-utility), system-ui, sans-serif;
  font-size: var(--le-utility); font-weight: var(--le-utility-weight);
  letter-spacing: var(--le-utility-tracking); text-transform: var(--le-utility-transform);
}

.le-foot { border-top: 1px solid var(--le-edge); padding: 40px 0 56px; }
.le-foot a {
  color: var(--le-accent-derived); display: inline-block;
  padding: 13px 8px; margin: -13px -8px; min-height: 44px;
}
.le-foot .le-tel { font-size: var(--le-body); }
.le-credit { margin-top: 20px; font-size: var(--le-utility); opacity: 0.6; }

@media (max-width: 720px) {
  .le-wrap { padding: 0 20px; }
  .le-anchor    { padding: var(--le-space-anchor-m) 0; }
  .le-connector { padding: var(--le-space-connector-m) 0; }
  .le-hero { padding: 56px 0 40px; }
  .le-hero-split { grid-template-columns: 1fr; gap: 32px; }
  .le-hero-media { height: clamp(240px, 60vw, 340px); }
  .le-gallery { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 150px; }
  .le-gallery > * { grid-column: span 1 !important; }
  .le-btn { width: 100%; }
  .le-facts { gap: 20px 32px; }
}

/* One orchestrated motion moment per page, and none at all for anyone who asked for none. */
@media (prefers-reduced-motion: reduce) {
  .le-site *, .le-site *::before, .le-site *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
`

// ── Section primitives ───────────────────────────────────────────────────────

export function Section({
  id, density = 'anchor', band, children,
}: {
  id?: string
  density?: 'anchor' | 'connector'
  /** Renders on --le-structure. Used to break a run of paper sections, per the rhythm rule. */
  band?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={[density === 'anchor' ? 'le-anchor' : 'le-connector', band ? 'le-band' : ''].join(' ').trim()}>
      <div className="le-wrap">{children}</div>
    </section>
  )
}

/** The primary action. `call` only ever renders when a dialable number exists — see `ctaFrom`. */
export function CtaButton({ content, quiet }: { content: SiteContent; quiet?: boolean }) {
  const cls = quiet ? 'le-btn le-btn-quiet' : 'le-btn'
  return content.cta.kind === 'call' && content.phone
    ? <a className={cls} href={telHref(content.phone)}>{content.cta.label}</a>
    : <a className={cls} href="#contact">{content.cta.label}</a>
}

export function PhoneLink({ content }: { content: SiteContent }) {
  if (!content.phone) return null
  return <a className="le-tel" href={telHref(content.phone)}>{content.phone}</a>
}

/**
 * Years in business, credentials, and service area — what a stranger checks before calling.
 *
 * Service area belongs in the first viewport: local intent is the whole game. Renders nothing when
 * none of the three was answered, rather than an empty bar.
 */
export function ProofBar({
  content, showAreas = true,
}: { content: SiteContent; showAreas?: boolean }) {
  const items: Array<[string, string]> = []
  if (content.yearsInBusiness) items.push(['In business', content.yearsInBusiness])
  if (content.credentials)     items.push(['Credentials', content.credentials])
  if (showAreas && content.serviceAreas?.length) items.push(['Serving', content.serviceAreas.join(' · ')])
  if (items.length === 0) return null

  return (
    <dl className="le-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Services as an asymmetric ladder rather than a grid of equal cards.
 *
 * No icons: an icon beside every list item encodes nothing, and the SKILL lists that as a tell.
 * No `01 / 02 / 03` markers either — a service list is not a sequence.
 */
export function Services({
  content, heading = 'Services', eyebrow = 'What we do',
}: { content: SiteContent; heading?: string; eyebrow?: string }) {
  if (!content.services?.length) return null
  return (
    <Section id="services" density="anchor">
      <p className="le-eyebrow">{eyebrow}</p>
      <h2 className="le-h2">{heading}</h2>
      <div className="le-ladder">
        {content.services.map(s => (
          <div key={s}><h3 className="le-h3">{s}</h3></div>
        ))}
      </div>
    </Section>
  )
}

export function Gallery({
  photos, eyebrow = 'Our work', heading = 'Recent work',
}: { photos: SitePhoto[]; eyebrow?: string; heading?: string }) {
  if (photos.length === 0) return null
  return (
    <Section id="work" density="anchor">
      <p className="le-eyebrow">{eyebrow}</p>
      <h2 className="le-h2">{heading}</h2>
      <div className="le-gallery">
        {photos.map(p => (
          <figure className="le-figure" key={p.id}>
            {/* Plain <img>: these are public Supabase Storage URLs, and next/image would need a
                remotePatterns entry per environment for no benefit on a static photo. */}
            <img className="le-photo" src={p.url} alt={p.caption ?? ''} loading="lazy" />
          </figure>
        ))}
      </div>
    </Section>
  )
}

/** Ironclad's signature: a photo band breaking the container, edge to edge. */
export function PhotoBand({ photo, businessName }: { photo?: SitePhoto; businessName: string }) {
  if (!photo) return null
  return (
    <div className="le-bleed">
      <img src={photo.url} alt={photo.caption ?? `Work by ${businessName}`} loading="lazy" />
    </div>
  )
}

/** "What makes you different" and the visitor message. Silent when neither was answered. */
export function About({
  content, showDifferentiator = true, band,
}: { content: SiteContent; showDifferentiator?: boolean; band?: boolean }) {
  const differentiator = showDifferentiator ? content.differentiator : undefined
  if (!differentiator && !content.intro) return null
  return (
    <Section id="about" density="connector" band={band}>
      <p className="le-eyebrow">Why us</p>
      <h2 className="le-h2">Why {content.businessName}</h2>
      {differentiator ? <p className="le-p le-lede">{differentiator}</p> : null}
      {content.intro ? <p className="le-p">{content.intro}</p> : null}
    </Section>
  )
}

export function Coverage({ content }: { content: SiteContent }) {
  if (!content.serviceAreas?.length) return null
  return (
    <Section id="coverage" density="connector">
      <p className="le-eyebrow">Where we work</p>
      <h2 className="le-h2">Areas we serve</h2>
      <p className="le-p le-lede">{content.serviceAreas.join(' · ')}</p>
    </Section>
  )
}

/**
 * The terminal call to action.
 *
 * In Phase 4 this holds the real lead form. Until then it renders the CTA and the phone, both of
 * which genuinely work, and `LeadFormPlaceholder` is visibly inert rather than a form that looks
 * live and silently discards a lead.
 */
export function Contact({ content, children }: { content: SiteContent; children?: ReactNode }) {
  // A form CTA scrolls here, so repeating its label confirms the visitor arrived. A `call` CTA
  // dials and never lands here, so reusing its label would print "Call Now" twice on one page.
  const heading = content.cta.kind === 'form' ? content.cta.label : 'Send us a message'
  return (
    <Section id="contact" density="anchor" band>
      <p className="le-eyebrow">Get in touch</p>
      <h2 className="le-h2">{heading}</h2>
      {content.phone ? <p className="le-p">Call <PhoneLink content={content} /></p> : null}
      {children}
    </Section>
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
 * A visibly inert stand-in for the Phase 4 lead form.
 *
 * It shows the real fields so the layout can be judged, and it cannot be submitted. A form that
 * looked live and dropped what a visitor typed would lose exactly the lead this product is sold to
 * capture — and nobody would ever know it happened.
 */
export function LeadFormPlaceholder() {
  return (
    <div className="le-formstub" aria-hidden="true">
      <p className="le-eyebrow" style={{ marginBottom: 18 }}>Lead form — activates in Phase 4</p>
      {['Your name', 'Phone', 'Email', 'How can we help?'].map(label => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div className="le-formstub-label">{label}</div>
          <div className="le-formstub-field" style={{ height: label.startsWith('How') ? 84 : 48 }} />
        </div>
      ))}
      <div className="le-formstub-send">Send</div>
    </div>
  )
}
