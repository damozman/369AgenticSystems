/**
 * The shared building blocks all three Lead Engine templates are made of.
 *
 * The templates differ in section ORDER and emphasis, not in capability. That is what keeps three
 * designs maintainable by one person: a fix to how services render fixes it everywhere, and no
 * template can quietly gain a feature the others lack.
 *
 * ── Why these are inline styles and not Tailwind classes ──
 * `app/globals.css` sets `body { background: var(--bg-base) }` — our dark portal theme — on every
 * Next-rendered route, and `app/layout.tsx` toggles `html.light` from a `portal-theme` value in
 * **the visitor's own localStorage**. A stranger reading a roofer's website would get our dark
 * admin theme; a portal user reading the same page would get the light one. That file also carries
 * a wall of `html.light .text-slate-400 { ... !important }` rules that would reach straight into
 * customer markup.
 *
 * So the mini-sites opt out entirely: their own custom properties, their own explicit colours, and
 * none of the portal's utility class names. `app/dossier/review/[id]/page.tsx` already does the
 * same thing for the same reason.
 *
 * ── The rule every section obeys ──
 * A section with no data renders NOTHING. Not a placeholder, not "Coming soon", not a stock photo.
 * A mini-site is what a stranger judges a real business by, and filler is a claim made on that
 * business's behalf.
 */

import type { ReactNode } from 'react'
import type { SiteContent, SitePhoto } from '@/lib/lead-engine/types'
import { telHref } from '@/lib/lead-engine/content'

/**
 * One accent, shared by all three templates.
 *
 * Deliberately a single token rather than a per-template colour: when a per-site accent picker
 * arrives it sets this one variable and all three designs follow. A colour hardcoded into each
 * template is three places to miss.
 */
export const DEFAULT_ACCENT = '#17457A'

export function siteStyles(accent: string = DEFAULT_ACCENT): string {
  return `
    .le-site {
      --accent: ${accent};
      --ink: #14161A;
      --ink-soft: #4A5261;
      --paper: #FFFFFF;
      --surface: #F6F7F9;
      --line: #E2E5EA;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .le-site *, .le-site *::before, .le-site *::after { box-sizing: border-box; }
    .le-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
    .le-section { padding: 56px 0; border-top: 1px solid var(--line); }
    .le-section:first-child { border-top: 0; }
    .le-eyebrow {
      font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--accent); margin: 0 0 10px;
    }
    .le-h2 { font-size: 28px; line-height: 1.2; margin: 0 0 18px; font-weight: 700; letter-spacing: -0.02em; }
    .le-p { margin: 0 0 14px; color: var(--ink-soft); font-size: 17px; max-width: 62ch; }

    .le-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      background: var(--accent); color: #fff; text-decoration: none;
      font-weight: 600; font-size: 17px; padding: 15px 28px; border-radius: 8px;
      min-height: 52px; border: 0; cursor: pointer;
    }
    .le-btn:hover { filter: brightness(1.08); }
    .le-btn-ghost {
      background: transparent; color: var(--accent); border: 1.5px solid var(--accent);
    }

    .le-grid { display: grid; gap: 16px; }
    .le-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .le-grid-2 { grid-template-columns: repeat(2, 1fr); }

    .le-card {
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 10px; padding: 20px;
    }
    .le-card h3 { margin: 0; font-size: 17px; font-weight: 650; }

    .le-trust { display: flex; flex-wrap: wrap; gap: 12px 32px; padding: 22px 0; }
    .le-trust div { min-width: 0; }
    .le-trust dt {
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--ink-soft); margin: 0 0 3px;
    }
    .le-trust dd { margin: 0; font-size: 16px; font-weight: 600; }

    .le-photo {
      width: 100%; aspect-ratio: 4 / 3; object-fit: cover;
      border-radius: 10px; display: block; background: var(--surface);
    }
    .le-figure { margin: 0; }
    .le-figure figcaption { font-size: 14px; color: var(--ink-soft); margin-top: 8px; }

    .le-hero { padding: 64px 0 48px; }
    .le-hero h1 { font-size: 44px; line-height: 1.08; margin: 0 0 16px; font-weight: 800; letter-spacing: -0.03em; }
    .le-hero-split { display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }

    /* The phone number is the highest-intent tap on the whole page, and as a bare inline <a> it
       measured 107x19 — well under the 44px minimum — at every width, on every template.
       scripts/mobile-audit.mjs found it; reasoning about the layout had not. */
    .le-tel {
      display: inline-flex; align-items: center; min-height: 44px;
      padding: 6px 10px; margin: -6px -10px; border-radius: 6px;
      color: var(--accent); font-weight: 600; text-decoration: none;
      font-size: 19px; letter-spacing: -0.01em;
    }
    .le-tel:hover { background: var(--surface); text-decoration: underline; }

    .le-foot { border-top: 1px solid var(--line); padding: 32px 0 44px; font-size: 15px; color: var(--ink-soft); }
    /* Same 44px rule as .le-tel, applied to every footer link. The Google Business Profile link
       measured 168x19 — a footer link is still a link someone taps on a phone. */
    .le-foot a {
      color: var(--accent); display: inline-block;
      padding: 13px 8px; margin: -13px -8px; min-height: 44px;
    }
    .le-foot .le-tel { font-size: 15px; }
    .le-credit { margin-top: 18px; font-size: 13px; color: #8A93A3; }

    /* Mobile first in practice: one column and larger touch targets under 720px.
       scripts/mobile-audit.mjs is the check, not reasoning about these numbers. */
    @media (max-width: 720px) {
      .le-hero { padding: 40px 0 32px; }
      .le-hero h1 { font-size: 32px; }
      .le-hero-split { grid-template-columns: 1fr; gap: 24px; }
      .le-grid-3, .le-grid-2 { grid-template-columns: 1fr; }
      .le-h2 { font-size: 24px; }
      .le-section { padding: 40px 0; }
      .le-btn { width: 100%; }
      .le-trust { gap: 16px 24px; }
    }
  `
}

export function Section({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="le-section">
      <div className="le-wrap">{children}</div>
    </section>
  )
}

/** The primary action. `call` only ever renders when a dialable number exists — see `ctaFrom`. */
export function CtaButton({ content, ghost }: { content: SiteContent; ghost?: boolean }) {
  const cls = ghost ? 'le-btn le-btn-ghost' : 'le-btn'
  return content.cta.kind === 'call' && content.phone
    ? <a className={cls} href={telHref(content.phone)}>{content.cta.label}</a>
    : <a className={cls} href="#contact">{content.cta.label}</a>
}

/**
 * Years in business, credentials and areas — the three things a stranger checks before calling.
 * Renders nothing at all when none of them was answered.
 *
 * `showAreas` is off for templates that give service areas a section of their own. The same list
 * printed twice on one page looks like the business could not decide, which is the impression this
 * bar exists to prevent.
 */
export function TrustBar({
  content,
  showAreas = true,
}: { content: SiteContent; showAreas?: boolean }) {
  const items: Array<[string, string]> = []
  if (content.yearsInBusiness) items.push(['In business', content.yearsInBusiness])
  if (content.credentials)     items.push(['Credentials', content.credentials])
  if (showAreas && content.serviceAreas?.length) items.push(['Serving', content.serviceAreas.join(' · ')])
  if (items.length === 0) return null

  return (
    <dl className="le-trust">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Services({ content }: { content: SiteContent }) {
  if (!content.services?.length) return null
  return (
    <Section id="services">
      <p className="le-eyebrow">What we do</p>
      <h2 className="le-h2">Services</h2>
      <div className={`le-grid ${content.services.length > 4 ? 'le-grid-3' : 'le-grid-2'}`}>
        {content.services.map(s => (
          <div className="le-card" key={s}><h3>{s}</h3></div>
        ))}
      </div>
    </Section>
  )
}

/**
 * Both labels are overridable because "Our work / Recent work" is a TRADES phrase. A party-rental
 * business does not do work, it hires things out, and a gallery titled "Our work" over a row of
 * bounce houses reads as a template nobody adapted. Caught by reading the rendered page.
 */
export function Gallery({
  photos,
  eyebrow = 'Our work',
  heading = 'Recent work',
}: { photos: SitePhoto[]; eyebrow?: string; heading?: string }) {
  if (photos.length === 0) return null
  return (
    <Section id="work">
      <p className="le-eyebrow">{eyebrow}</p>
      <h2 className="le-h2">{heading}</h2>
      <div className="le-grid le-grid-3">
        {photos.map(p => (
          <figure className="le-figure" key={p.id}>
            {/* Plain <img>, not next/image: these are Supabase Storage URLs on a public bucket and
                next/image would need a remotePatterns entry per environment for no benefit here. */}
            <img className="le-photo" src={p.url} alt={p.caption ?? ''} loading="lazy" />
            {p.caption ? <figcaption>{p.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </Section>
  )
}

/**
 * "What makes you different" and the visitor message. Silent when neither was answered.
 *
 * `showDifferentiator` exists because Trade Classic already uses that line as its hero subheading.
 * Printing the same sentence twice on a short page reads as a mistake by the business, not by us.
 */
export function About({
  content,
  showDifferentiator = true,
}: { content: SiteContent; showDifferentiator?: boolean }) {
  const differentiator = showDifferentiator ? content.differentiator : undefined
  if (!differentiator && !content.intro) return null
  return (
    <Section id="about">
      <p className="le-eyebrow">About us</p>
      <h2 className="le-h2">Why {content.businessName}</h2>
      {differentiator ? <p className="le-p">{differentiator}</p> : null}
      {content.intro ? <p className="le-p">{content.intro}</p> : null}
    </Section>
  )
}

/**
 * The contact section.
 *
 * In Phase 4 this holds the real lead form. Until then it renders the CTA and the phone number,
 * both of which genuinely work — and `LeadFormPlaceholder` is deliberately, visibly inert rather
 * than a form that looks live and silently discards a lead.
 */
export function Contact({ content, children }: { content: SiteContent; children?: ReactNode }) {
  // A form CTA scrolls HERE, so repeating its label as the heading confirms the visitor arrived at
  // the right place. A `call` CTA dials instead — it never lands here — so using its label would be
  // the word "Call Now" printed twice on a short page for no reason. Found by reading the page.
  const heading = content.cta.kind === 'form' ? content.cta.label : 'Send us a message'

  return (
    <Section id="contact">
      <p className="le-eyebrow">Get in touch</p>
      <h2 className="le-h2">{heading}</h2>
      {content.phone ? (
        // Deliberately no "— serving X" here. Areas already appear in the trust bar or in their own
        // section; a third printing of the same list reads as padding.
        <p className="le-p">
          Call <a className="le-tel" href={telHref(content.phone)}>{content.phone}</a>
        </p>
      ) : null}
      {children}
    </Section>
  )
}

export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="le-foot">
      <div className="le-wrap">
        <strong style={{ color: 'var(--ink)' }}>{content.businessName}</strong>
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
 * capture — and the person who lost it would never know it happened.
 */
export function LeadFormPlaceholder() {
  return (
    <div
      className="le-card"
      style={{ maxWidth: 520, borderStyle: 'dashed', opacity: 0.75 }}
      aria-hidden="true"
    >
      <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A93A3' }}>
        Lead form — activates in Phase 4
      </p>
      {['Your name', 'Phone', 'Email', 'How can we help?'].map(label => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--ink-soft)' }}>{label}</div>
          <div style={{ height: label.startsWith('How') ? 76 : 44, background: '#fff', border: '1px solid var(--line)', borderRadius: 7 }} />
        </div>
      ))}
      <div className="le-btn" style={{ opacity: 0.45, pointerEvents: 'none' }}>Send</div>
    </div>
  )
}
