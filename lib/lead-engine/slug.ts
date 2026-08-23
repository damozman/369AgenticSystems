/**
 * The public URL segment for a mini-site: /sites/<slug>.
 *
 * A slug is customer-visible, printed on cards, and effectively permanent once a business puts it
 * on a van — so it is validated once, here, rather than trusted from a form.
 */

/**
 * Names a slug may not take.
 *
 * Today slugs are namespaced under /sites/, so none of these can actually collide. They are
 * reserved anyway because the plan is explicitly to move to `<slug>.369agenticsystems.com` later
 * by rewriting onto this same route — and at that point the slug becomes a HOSTNAME, where `www`,
 * `mail` and `app` stop being decorative. Reserving them now costs nothing; taking one back from a
 * paying customer whose slug is on their signage costs a customer.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Would become real subdomains.
  'www', 'mail', 'smtp', 'imap', 'ftp', 'app', 'api', 'cdn', 'static', 'assets', 'admin',
  'dashboard', 'portal', 'login', 'auth', 'account', 'billing', 'support', 'help', 'status',
  // Existing top-level routes in this app, in case slugs are ever un-namespaced.
  'agents', 'sites', 'dossier', 'onboarding', 'privacy', 'terms', 'book-demo', 'founding',
  'robots', 'sitemap', 'favicon',
  // Words that read as a system page rather than a business.
  'new', 'edit', 'delete', 'test', 'demo', 'example', 'null', 'undefined',
])

export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 48

export type SlugCheck =
  | { valid: true }
  | { valid: false; reason: string }

/**
 * Turn a business name into a candidate slug.
 *
 * Accents are folded rather than stripped, so "Bäcker Roofing" becomes `backer-roofing` instead of
 * `bcker-roofing`. Returns '' when nothing usable survives, which the caller must handle — a
 * business named entirely in a non-Latin script is a real case, and silently producing a slug of
 * empty string would insert a row whose URL is /sites/.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip the combining marks NFKD just separated out. Written as escapes rather than literal
    // characters so the intent survives an editor that normalises the file.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')        // O'Brien -> obrien, not o-brien
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '')              // the slice may have landed mid-separator
}

/**
 * Whether a slug may be used.
 *
 * Refuses rather than repairs. Quietly "fixing" a slug the customer typed means the URL they were
 * shown on the form is not the URL they get, and they find out when a card is already printed.
 */
export function validateSlug(slug: string): SlugCheck {
  if (!slug) return { valid: false, reason: 'A web address is required.' }
  if (slug.length < SLUG_MIN_LENGTH) {
    return { valid: false, reason: `Too short — use at least ${SLUG_MIN_LENGTH} characters.` }
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return { valid: false, reason: `Too long — use at most ${SLUG_MAX_LENGTH} characters.` }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      valid: false,
      reason: 'Use lowercase letters, numbers and single hyphens only, starting and ending with a letter or number.',
    }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: 'That web address is reserved. Please choose another.' }
  }
  return { valid: true }
}

/**
 * The slug to propose on the form: the customer's own preference if it is usable, otherwise one
 * derived from the business name. Returns null when neither yields anything valid, so the caller
 * asks rather than inventing `site-1`.
 */
export function proposeSlug(businessName: string, preferred?: string | null): string | null {
  for (const candidate of [preferred, businessName]) {
    if (!candidate) continue
    const s = slugify(candidate)
    if (validateSlug(s).valid) return s
  }
  return null
}
