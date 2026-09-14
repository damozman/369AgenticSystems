/**
 * The absolute origin a mini-site is served from.
 *
 * ── Why this exists ──
 * `NEXT_PUBLIC_SITE_ORIGIN` is read in three places and is **not set anywhere** — not in
 * `.env.local`, and nothing in this repo sets it in Vercel. Every one of those readers did
 * `(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '')`, so the JSON-LD on a live mini-site has been
 * emitting `"url": "/sites/bell-avenue"`. schema.org requires an absolute URL there; a relative one
 * is silently dropped by Google's parser, which is the same "built, wired, never fed" shape this
 * project keeps paying for — the markup validates as present and answers nothing.
 *
 * A sitemap makes it unignorable: `<loc>` MUST be absolute, so an empty origin produces a file the
 * crawler rejects outright.
 *
 * ── The order, and why ──
 * 1. `NEXT_PUBLIC_SITE_ORIGIN` when set — the override, for a custom domain.
 * 2. The request's own origin when one is available. This is what makes a local run produce
 *    `http://localhost:3000` URLs instead of pointing a developer at production.
 * 3. The production domain. Not an empty string: a wrong-but-absolute URL is visibly wrong, while
 *    an empty one produces markup that looks fine and does nothing.
 */
export const DEFAULT_SITE_ORIGIN = 'https://369agenticsystems.com'

export function siteOrigin(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin
    } catch {
      // Fall through to the default rather than throwing inside a render.
    }
  }

  return DEFAULT_SITE_ORIGIN
}
