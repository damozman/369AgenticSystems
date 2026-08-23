/**
 * The layout for public customer mini-sites.
 *
 * Its whole job is to STOP the portal's styling reaching a customer's website.
 *
 * `app/globals.css` paints `body` with `var(--bg-base)` — our dark admin theme — on every
 * Next-rendered route, and `app/layout.tsx` runs an inline script that adds `html.light` when the
 * VISITOR's own localStorage happens to hold a `portal-theme` key. Left alone, a stranger reading a
 * roofer's website would get our dark Command Center palette, and someone who had used our portal
 * would get a different page from someone who had not. That is not a theming quirk; it is the
 * customer's shop window rendering differently per visitor.
 *
 * Next allows only one root layout, so the `<body>` rule cannot be removed here. Instead the site
 * is wrapped in a full-height opaque surface that paints over it, and every colour inside is set
 * explicitly rather than inherited. The templates likewise use their own class names, so
 * globals.css's `html.light .text-slate-400 { … !important }` block has nothing to grab.
 */

export default function SitesLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#FFFFFF', color: '#14161A', minHeight: '100vh' }}>{children}</div>
}
