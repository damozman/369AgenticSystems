/**
 * Whether this deployment may serve a site that is not live.
 *
 * Review sites are seeded as `draft` so they cannot be reached in production: a `review-` row at
 * `status = 'live'` would put eight fictional businesses — with fictional licence numbers,
 * credentials and testimonials — on 369agenticsystems.com the moment this branch deploys.
 * `robots: noindex` does not prevent that; it only asks search engines not to list it.
 *
 * ── Why this is written exactly like this ──
 *
 * 1. **A direct `process.env.LEAD_ENGINE_PREVIEW` reference, never `process.env[name]`.** Next
 *    inlines these at build time by textual substitution, so a computed key is not substituted and
 *    silently evaluates to `undefined` — which would make the gate fail OPEN in production while
 *    passing every local test.
 *
 * 2. **An exact `=== 'true'` comparison, with no trimming and no case folding.** `'True'` and
 *    `' true '` are refused on purpose; they are precisely what a well-meaning
 *    `.trim().toLowerCase()` "tidy-up" would let through, and `preview.test.ts` asserts both stay
 *    closed. The default is closed, and only the exact literal opens it.
 *
 * This is the whole safety property of the review fixtures. If it is ever loosened, the test is
 * what should fail loudly.
 */
export function previewEnabled(): boolean {
  return process.env.LEAD_ENGINE_PREVIEW === 'true'
}
