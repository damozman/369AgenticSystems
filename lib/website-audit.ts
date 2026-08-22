/**
 * Turns a prospect's homepage into observations that are exactly true.
 *
 * Dossier section 4. The sibling of `lib/audit-call.ts`, and it follows the same two rules,
 * because they are what separate this from the Gumloop "audit" it replaces — the one that handed
 * a `seo_visibility` and a `security_score` of 41 to every business it ever saw.
 *
 * **1. Only state what the fetch actually establishes.** "We could not find a phone number on your
 * homepage" is a fact about a document we read. "Your site has poor conversion" is an inference
 * nobody earned. There are no scores here, no 0–100 of anything, and no benchmark against an
 * industry average that does not exist.
 *
 * **2. Our own failures are never findings about them.** A DNS failure, a timeout, a 403 from a
 * bot filter, or a prospect who left the URL blank are all facts about our fetch. Reporting any of
 * them as "your website has no contact form" would be fabrication of exactly the kind this
 * replaces. Those come back `reportable: false` and must never reach a prospect.
 *
 * **The third rule, which this module needs and the call one does not:** *absence of evidence is
 * not evidence of absence.* We fetch HTML and never execute JavaScript. On a client-rendered site
 * the markup is a near-empty shell, so "no contact form" would mean "the form is built by a script
 * we did not run". Every negative on such a page degrades to `undetermined` rather than `absent` —
 * see `looksClientRendered`. A confidently wrong observation about a prospect's own website is the
 * fastest way to lose them, because it is the one claim in the whole dossier they can check
 * instantly and know is false.
 */

/** What a single check concluded. `undetermined` is a first-class answer, not a failure. */
export type Finding = 'present' | 'absent' | 'undetermined'

export type ObservationId =
  | 'phone_published'
  | 'tap_to_call'
  | 'contact_form'
  | 'hours_published'
  | 'after_hours'
  | 'mobile_viewport'
  | 'html_weight'

export interface Observation {
  id: ObservationId
  finding: Finding
  /** One sentence stating only what was observed. Safe to put in front of the prospect. */
  sentence: string
  /** What was actually matched, so a human can verify the claim in ten seconds. */
  evidence?: string
}

/** Why a fetch told us nothing about the business. Never shown as a finding. */
export type UnreportableReason =
  | 'no_url'        // the prospect left the website field blank
  | 'fetch_failed'  // DNS, TLS, timeout, connection refused
  | 'http_error'    // the server answered, but not with a page
  | 'blocked'       // 401/403/429 — a bot filter, not a missing website
  | 'not_html'      // a PDF, an image, a JSON API
  | 'empty'         // 200 with nothing in it
  | 'no_content'    // a bouncer or a parked stub — a document, but not their homepage

export interface WebsiteAudit {
  /** False means this fetch is evidence of nothing and the dossier must omit the section. */
  reportable: boolean
  unreportable?: UnreportableReason
  /** Operator-facing explanation. Always present. */
  detail: string
  observations: Observation[]
  /** True when the markup is a shell, which is why negatives degrade to `undetermined`. */
  clientRendered: boolean
  /** The URL actually read, after redirects. */
  url?: string
  /**
   * Where a bouncer page was trying to send us, when `unreportable` is `no_content`.
   * `fetchHomepage` follows this exactly once.
   */
  redirectHint?: string
}

export interface PageInput {
  url: string
  status: number
  contentType: string
  /** The raw response body. */
  html: string
  /** Bytes of the HTML document itself — not subresources. See `html_weight`. */
  bytes: number
}

// ── Text extraction ─────────────────────────────────────────────────────────
// Scripts and styles are stripped before looking for human-visible things. A phone number inside
// an analytics snippet is not a published phone number, and matching one would produce an
// observation the prospect cannot see on their own page.

function stripCode(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

function visibleText(html: string): string {
  return stripCode(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Where a bouncer page is trying to send the visitor, if it is one.
 *
 * Parked domains and "lander" setups serve a few bytes whose only job is to redirect — by
 * `<meta http-equiv="refresh">` or by assigning `window.location`. Found on the project's own test
 * client, `Northsideroofing.com`, which serves 114 bytes of exactly this.
 */
export function redirectTarget(html: string): string | null {
  const meta = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"';]+)/i)
  if (meta) return meta[1].trim()
  const js = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
  if (js) return js[1].trim()
  const replace = html.match(/location\.replace\(\s*["']([^"']+)["']\s*\)/i)
  if (replace) return replace[1].trim()
  return null
}

/**
 * A document with nothing in it that a visitor would call a homepage.
 *
 * Distinct from a client-rendered shell, which at least commits to a real page and whose viewport
 * tag and byte count are still honest facts. This is a bouncer or a parked placeholder — reading
 * one and reporting "no phone number, no contact form, no hours, no viewport" would be six
 * confident findings about a page the prospect has never seen.
 */
export function looksContentless(html: string): boolean {
  const text = visibleText(html)

  // A bouncer: its whole job is to send the visitor somewhere else, and whatever few words it
  // carries ("Redirecting…") are not their homepage. This is the Northsideroofing.com shape.
  if (redirectTarget(html) && text.length < 200) return true

  // Genuinely nothing to read. Deliberately strict — a sparse but real homepage still deserves
  // its observations, and over-firing here silently deletes a whole dossier section.
  if (text.length >= 40) return false
  const links = (html.match(/<a\b/gi) ?? []).length
  const hasForm = /<form\b/i.test(html)
  const hasImg = /<img\b/i.test(html)
  const hasHeading = /<h[1-3]\b/i.test(html)
  return links < 2 && !hasForm && !hasImg && !hasHeading
}

/**
 * Does this look like a page whose content is assembled by JavaScript?
 *
 * A React/Vue/Angular shell serves a mount point and a bundle, and almost no text. Reading one and
 * concluding "there is no contact form" describes our fetch, not their website.
 */
export function looksClientRendered(html: string): boolean {
  const text = visibleText(html)
  if (text.length > 600) return false
  const hasScript = /<script\b/i.test(html)
  const hasMount = /<div[^>]+id=["'](root|app|__next|__nuxt|application)["']/i.test(html)
  const hasBundle = /<script[^>]+src=["'][^"']*\.(?:m?js)(?:\?[^"']*)?["']/i.test(html)
  return hasScript && (hasMount || (hasBundle && text.length < 200))
}

// ── Individual checks ───────────────────────────────────────────────────────

const TEL_HREF = /href=["']tel:([^"']+)["']/i
// North American shapes people actually publish. Deliberately conservative: a false positive here
// tells a prospect their number is published when it is not.
const PHONE_TEXT = /(?:\+?1[\s.\-]?)?\(?\b[2-9]\d{2}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/

function checkPhone(html: string, text: string): Observation {
  const tel = html.match(TEL_HREF)
  if (tel) {
    return {
      id: 'phone_published',
      finding: 'present',
      sentence: 'Your phone number is published on your homepage.',
      evidence: `tel: link to ${tel[1].trim()}`,
    }
  }
  const inText = text.match(PHONE_TEXT)
  if (inText) {
    return {
      id: 'phone_published',
      finding: 'present',
      sentence: 'Your phone number is published on your homepage.',
      evidence: `found in page text: ${inText[0]}`,
    }
  }
  return {
    id: 'phone_published',
    finding: 'absent',
    sentence: 'We could not find a phone number on your homepage.',
  }
}

function checkTapToCall(html: string, phone: Observation): Observation {
  const tel = html.match(TEL_HREF)
  if (tel) {
    return {
      id: 'tap_to_call',
      finding: 'present',
      sentence: 'Your number is a tap-to-call link, so a phone visitor can dial it in one tap.',
      evidence: `href="tel:${tel[1].trim()}"`,
    }
  }
  // Only meaningful once a number is on the page at all.
  if (phone.finding === 'present') {
    return {
      id: 'tap_to_call',
      finding: 'absent',
      sentence:
        'Your number is written as text rather than a tap-to-call link, so a visitor on a phone ' +
        'has to copy it out by hand.',
    }
  }
  return {
    id: 'tap_to_call',
    finding: 'undetermined',
    sentence: '',
    evidence: 'no phone number found, so tap-to-call does not apply',
  }
}

/**
 * A form the visitor can send a message with.
 *
 * A search box is not a contact form, and counting one would be the kind of confidently wrong
 * observation this module exists to avoid. Embedded third-party forms are matched on their script
 * host, because their markup arrives client-side and would otherwise read as absent.
 */
const FORM_EMBED =
  /(hsforms\.net|hubspot\.com\/forms|typeform\.com|jotform\.com|wufoo\.com|formstack\.com|gravityforms|formspree\.io|tally\.so|forms\.gle|calendly\.com)/i

function checkContactForm(html: string): Observation {
  const embed = html.match(FORM_EMBED)
  if (embed) {
    return {
      id: 'contact_form',
      finding: 'present',
      sentence: 'Your homepage carries a contact form.',
      evidence: `embedded form provider: ${embed[1]}`,
    }
  }

  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? []
  let undetermined = false
  for (const form of forms) {
    const isSearch =
      /role=["']search["']/i.test(form) ||
      /type=["']search["']/i.test(form) ||
      /(?:name|id|class)=["'][^"']*search/i.test(form) ||
      /action=["'][^"']*search/i.test(form)
    if (isSearch) continue

    // A message box is what makes it a contact form. This is the only unambiguous signal.
    const hasMessage =
      /<textarea\b/i.test(form) ||
      /(?:name|id)=["'][^"']*(?:message|comment|enquir|inquir|describe|details)/i.test(form)
    if (hasMessage) {
      return {
        id: 'contact_form',
        finding: 'present',
        sentence: 'Your homepage carries a contact form.',
        evidence: 'a <form> with a message field',
      }
    }

    // No message box, so the form's purpose has to be read off it. A lone email input is the
    // trap: on real sites it is usually a newsletter signup, and calling that a contact form is
    // a claim the prospect can disprove in one glance at their own page.
    const purpose = form.match(/(?:action|id|class|name)=["'][^"']*(contact|quote|estimate|book|appointment|consult|callback|get-in-touch|enquir|inquir|audit|intake|demo|request)/i)
    if (purpose && /<input[^>]+type=["'](?:email|tel)["']/i.test(form)) {
      return {
        id: 'contact_form',
        finding: 'present',
        sentence: 'Your homepage carries a contact form.',
        evidence: `a form marked "${purpose[1]}" with a contact field`,
      }
    }

    const newsletter = /(newsletter|subscribe|signup|sign-up|mailing|mc4wp|klaviyo)/i.test(form)
    if (!newsletter && /<input[^>]+type=["']email["']/i.test(form)) {
      // An email box with nothing saying what it is for. Under-claiming beats guessing.
      undetermined = true
    }
  }

  if (undetermined) {
    return {
      id: 'contact_form',
      finding: 'undetermined',
      sentence: '',
      evidence: 'an email field was found, but nothing identified it as a contact form',
    }
  }

  return {
    id: 'contact_form',
    finding: 'absent',
    sentence: 'We could not find a contact form on your homepage.',
  }
}

const DAY = /(mon|tue|wed|thu|fri|sat|sun)/i
const TIME = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)\b|\b(?:[01]\d|2[0-3]):[0-5]\d\b/i

function checkHours(html: string, text: string): Observation {
  if (/openingHours|openingHoursSpecification/i.test(html)) {
    return {
      id: 'hours_published',
      finding: 'present',
      sentence: 'Your opening hours are published on your homepage.',
      evidence: 'schema.org openingHours markup',
    }
  }
  // A day name and a time close together is what published hours actually look like. Requiring
  // proximity keeps "Monday" in a blog date from counting as opening hours.
  const windows = text.match(/[^.]{0,80}(?:mon|tue|wed|thu|fri|sat|sun)[^.]{0,80}/gi) ?? []
  for (const w of windows) {
    if (DAY.test(w) && TIME.test(w)) {
      return {
        id: 'hours_published',
        finding: 'present',
        sentence: 'Your opening hours are published on your homepage.',
        evidence: w.trim().slice(0, 90),
      }
    }
  }
  return {
    id: 'hours_published',
    finding: 'absent',
    sentence: 'We could not find your opening hours on your homepage.',
  }
}

const AFTER_HOURS =
  /24\s*\/\s*7|24-7|24\s*hours?\b|around the clock|after[- ]hours|emergency service|emergency call|same[- ]day service|always open|open 24/i

function checkAfterHours(text: string): Observation {
  const m = text.match(AFTER_HOURS)
  if (m) {
    return {
      id: 'after_hours',
      finding: 'present',
      sentence: 'Your homepage tells visitors you are reachable outside normal hours.',
      evidence: m[0],
    }
  }
  return {
    id: 'after_hours',
    finding: 'absent',
    sentence:
      'Your homepage does not tell a visitor what happens if they call outside business hours.',
  }
}

function checkViewport(html: string): Observation {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) {
    return {
      id: 'mobile_viewport',
      finding: 'present',
      sentence: 'Your homepage is set up to scale properly on a phone.',
      evidence: '<meta name="viewport">',
    }
  }
  return {
    id: 'mobile_viewport',
    finding: 'absent',
    sentence:
      'Your homepage has no mobile viewport tag, so phone browsers render it at desktop width ' +
      'and zoom out.',
  }
}

/**
 * Size of the HTML document, and *only* the HTML document.
 *
 * Named `html_weight` rather than `page_weight` on purpose. We fetch one document and no
 * subresources, so we have not measured what "page weight" normally means — images, fonts and
 * scripts are all excluded. Reporting this as the page's weight would overstate what was measured,
 * and the sentence says exactly what was counted.
 */
export const HTML_WEIGHT_NOTE_KB = 500

function checkHtmlWeight(bytes: number): Observation {
  const kb = Math.round(bytes / 1024)
  const size = kb < 1 ? 'under 1 KB' : `${kb} KB`
  return {
    id: 'html_weight',
    finding: 'present',
    sentence:
      `Your homepage's HTML is ${size} before images, fonts or scripts are counted.`,
    evidence: `${bytes} bytes`,
  }
}

// ── The pure entry point ────────────────────────────────────────────────────

/**
 * Analyses one already-fetched page. Pure: same input, same output, no network, no clock.
 *
 * The fetch is deliberately somebody else's job (`fetchHomepage`) so every branch here is testable
 * without a live website — which is the whole reason this is the easiest piece of the dossier to
 * get right.
 */
export function analysePage(input: PageInput): WebsiteAudit {
  const { url, status, contentType, html, bytes } = input

  if (status === 401 || status === 403 || status === 429) {
    return {
      reportable: false,
      unreportable: 'blocked',
      detail: `${url} answered ${status} — a bot filter, which says nothing about the site itself.`,
      observations: [],
      clientRendered: false,
      url,
    }
  }
  if (status < 200 || status >= 300) {
    return {
      reportable: false,
      unreportable: 'http_error',
      detail: `${url} answered ${status}, so no page was read.`,
      observations: [],
      clientRendered: false,
      url,
    }
  }
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    return {
      reportable: false,
      unreportable: 'not_html',
      detail: `${url} returned ${contentType}, not a web page.`,
      observations: [],
      clientRendered: false,
      url,
    }
  }
  if (!html.trim()) {
    return {
      reportable: false,
      unreportable: 'empty',
      detail: `${url} returned an empty body.`,
      observations: [],
      clientRendered: false,
      url,
    }
  }

  const text = visibleText(html)
  const clientRendered = looksClientRendered(html)

  // A bouncer or a parked stub is not their homepage, and every negative drawn from one would be
  // a confident claim about a page the prospect has never seen. Checked after the shell test, so
  // a real single-page app still reports the facts that survive it.
  if (!clientRendered && looksContentless(html)) {
    const hint = redirectTarget(html)
    return {
      reportable: false,
      unreportable: 'no_content',
      detail: hint
        ? `${url} is a redirect stub pointing at ${hint}, not a homepage.`
        : `${url} returned a page with no content to read.`,
      observations: [],
      clientRendered: false,
      url,
      ...(hint ? { redirectHint: hint } : {}),
    }
  }

  const phone = checkPhone(html, text)
  const observations: Observation[] = [
    phone,
    checkTapToCall(html, phone),
    checkContactForm(html),
    checkHours(html, text),
    checkAfterHours(text),
    checkViewport(html),
    checkHtmlWeight(bytes),
  ]

  /**
   * On a shell page, downgrade every negative.
   *
   * `mobile_viewport` and `html_weight` are exempt: the viewport tag is in the served HTML by
   * definition — a script cannot add one that a phone would honour on first paint — and the byte
   * count is of the document we actually received either way.
   */
  const survivesShell = new Set<ObservationId>(['mobile_viewport', 'html_weight'])
  const finalObs = clientRendered
    ? observations.map(o =>
        o.finding === 'absent' && !survivesShell.has(o.id)
          ? {
              ...o,
              finding: 'undetermined' as const,
              sentence: '',
              evidence:
                'the homepage is built in the browser, so this could not be checked from the ' +
                'HTML alone',
            }
          : o)
    : observations

  return {
    reportable: true,
    detail: clientRendered
      ? `Read ${url}. The page renders client-side, so unconfirmed checks are reported as ` +
        `undetermined rather than as absent.`
      : `Read ${url}.`,
    observations: finalObs,
    clientRendered,
    url,
  }
}

/** Only the observations that may be shown to a prospect. */
export function reportable(audit: WebsiteAudit): Observation[] {
  return audit.observations.filter(o => o.finding !== 'undetermined' && o.sentence)
}

// ── The impure edge ─────────────────────────────────────────────────────────

export const FETCH_TIMEOUT_MS = 10_000
/** Enough for any homepage; stops a stray large response from being read into memory. */
export const MAX_HTML_BYTES = 3_000_000

/**
 * Fetches a homepage. The only function here that touches the network.
 *
 * Every failure returns `reportable: false` with a reason, and never throws — a site being
 * unreachable must degrade the dossier's website section, never cost the dossier.
 */
export async function fetchHomepage(rawUrl: string): Promise<WebsiteAudit> {
  const first = await fetchOnce(rawUrl)

  /**
   * Follow a bouncer exactly once.
   *
   * `fetch` follows HTTP redirects on its own, but a parked domain often bounces with a meta
   * refresh or `window.location` instead, which is invisible to it. The project's own test client
   * does exactly this. One hop only — a chain of them is a site that does not want to be read, and
   * this must never become a crawler.
   */
  if (first.unreportable === 'no_content' && first.redirectHint && first.url) {
    let next: string
    try {
      next = new URL(first.redirectHint, first.url).toString()
    } catch {
      return first
    }
    if (next === first.url) return first
    const second = await fetchOnce(next)
    // Only take the second read if it actually got us somewhere.
    if (second.reportable) {
      return { ...second, detail: `${second.detail} Followed a redirect stub at ${first.url}.` }
    }
  }

  return first
}

async function fetchOnce(rawUrl: string): Promise<WebsiteAudit> {
  const trimmed = (rawUrl ?? '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'none') {
    return {
      reportable: false,
      unreportable: 'no_url',
      detail: 'No website was given on the form, so there was nothing to read.',
      observations: [],
      clientRendered: false,
    }
  }

  let url: string
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).toString()
  } catch {
    return {
      reportable: false,
      unreportable: 'no_url',
      detail: `"${trimmed}" is not a usable URL.`,
      observations: [],
      clientRendered: false,
    }
  }

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Identify ourselves honestly. A prospect's admin reading their logs should be able to
        // tell who this was, and a disguised crawler is not something to ship.
        'User-Agent': '369AgenticSystems-SiteCheck/1.0 (+https://369agenticsystems.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    const body = await res.text()
    const html = body.length > MAX_HTML_BYTES ? body.slice(0, MAX_HTML_BYTES) : body

    return analysePage({
      url: res.url || url,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      html,
      bytes: new TextEncoder().encode(html).length,
    })
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    return {
      reportable: false,
      unreportable: 'fetch_failed',
      detail: `Could not reach ${url} (${why}). That is a fact about our fetch, not about the site.`,
      observations: [],
      clientRendered: false,
      url,
    }
  }
}
