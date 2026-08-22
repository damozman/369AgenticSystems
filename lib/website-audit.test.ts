import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  analysePage, looksClientRendered, looksContentless, redirectTarget, reportable,
  type PageInput, type ObservationId, type Finding,
} from '@/lib/website-audit'

/**
 * Wraps a fragment in enough markup to be a plausible homepage.
 *
 * Fixtures used to be 30-character documents, which the contentless guard correctly rejected as
 * bouncers — a real business homepage is never that thin, and shrinking the guard to accommodate
 * toy HTML would have weakened the check that a real fetch proved was needed.
 */
const realPage = (body: string) =>
  `<html><head><title>Fort Worth Roofing</title></head><body>
   <nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a></nav>
   <h1>Fort Worth Roofing</h1>
   <p>Residential and commercial roof repair, replacement and storm damage restoration
      across Tarrant County since 2010. Licensed, insured and locally owned.</p>
   ${body}
   </body></html>`

const page = (html: string, over: Partial<PageInput> = {}): PageInput => ({
  url: 'https://example.com/',
  status: 200,
  contentType: 'text/html; charset=utf-8',
  html,
  bytes: Buffer.byteLength(html),
  ...over,
})

const find = (html: string, id: ObservationId): Finding =>
  analysePage(page(html)).observations.find(o => o.id === id)!.finding

const shell = `<html><head><title>x</title></head><body><div id="root"></div>
  <script src="/static/js/main.8f3a.js"></script></body></html>`

// ── Our failures are never findings about them ──────────────────────────────

test('a bot filter is not a finding about the business', () => {
  for (const status of [401, 403, 429]) {
    const a = analysePage(page('<html></html>', { status }))
    assert.equal(a.reportable, false)
    assert.equal(a.unreportable, 'blocked')
    assert.deepEqual(a.observations, [])
  }
})

test('an http error yields nothing reportable', () => {
  const a = analysePage(page('<html></html>', { status: 500 }))
  assert.equal(a.reportable, false)
  assert.equal(a.unreportable, 'http_error')
})

test('a PDF is not a web page', () => {
  const a = analysePage(page('%PDF-1.4', { contentType: 'application/pdf' }))
  assert.equal(a.reportable, false)
  assert.equal(a.unreportable, 'not_html')
})

test('an empty 200 is not a finding', () => {
  const a = analysePage(page('   '))
  assert.equal(a.reportable, false)
  assert.equal(a.unreportable, 'empty')
})

test('a missing content-type does not disqualify a real page', () => {
  const a = analysePage(page(realPage('<p>Hello</p>'), { contentType: '' }))
  assert.equal(a.reportable, true)
})

// ── Absence of evidence is not evidence of absence ──────────────────────────

test('a client-rendered shell is recognised', () => {
  assert.equal(looksClientRendered(shell), true)
  assert.equal(looksClientRendered('<html><body>' + 'word '.repeat(300) + '</body></html>'), false)
})

test('negatives on a shell page become undetermined, never absent', () => {
  const a = analysePage(page(shell))
  assert.equal(a.reportable, true)
  assert.equal(a.clientRendered, true)
  for (const id of ['phone_published', 'contact_form', 'hours_published', 'after_hours'] as const) {
    const o = a.observations.find(x => x.id === id)!
    assert.equal(o.finding, 'undetermined', `${id} must not be reported absent on a shell`)
    assert.equal(o.sentence, '', `${id} must have no prospect-facing sentence`)
  }
})

test('viewport and weight still count on a shell page', () => {
  // A script cannot add a viewport tag the first paint would honour, and the byte count is of the
  // document we actually received either way.
  const a = analysePage(page(shell))
  assert.equal(a.observations.find(o => o.id === 'mobile_viewport')!.finding, 'absent')
  assert.equal(a.observations.find(o => o.id === 'html_weight')!.finding, 'present')
})

test('a positive on a shell page is still a positive', () => {
  const withPhone = shell.replace('<div id="root">', '<a href="tel:+18175551212">Call</a><div id="root">')
  assert.equal(find(withPhone, 'phone_published'), 'present')
})

test('reportable() hides undetermined observations', () => {
  const out = reportable(analysePage(page(shell)))
  assert.ok(out.every(o => o.finding !== 'undetermined' && o.sentence.length > 0))
})

// ── Phone and tap-to-call ───────────────────────────────────────────────────

test('a tel: link is a published, tappable number', () => {
  const html = realPage('<a href="tel:+18175551212">Call us</a>')
  assert.equal(find(html, 'phone_published'), 'present')
  assert.equal(find(html, 'tap_to_call'), 'present')
})

test('a number in text is published but not tappable', () => {
  const html = realPage('<p>Call us on (817) 555-1212 today</p>')
  assert.equal(find(html, 'phone_published'), 'present')
  assert.equal(find(html, 'tap_to_call'), 'absent')
})

test('tap-to-call is undetermined when there is no number at all', () => {
  // "Not tappable" would imply a number exists to tap.
  const html = realPage('<p>Call today for a free estimate.</p>')
  assert.equal(find(html, 'phone_published'), 'absent')
  assert.equal(find(html, 'tap_to_call'), 'undetermined')
})

test('a phone number inside a script is not a published number', () => {
  // Matching one would claim something the prospect cannot see on their own page.
  const html = realPage('<script>var support = "817-555-1212";</script>')
  assert.equal(find(html, 'phone_published'), 'absent')
})

test('a date or a price is not mistaken for a phone number', () => {
  const html = realPage('<p>Established 2010. Jobs from $1,250. Call today!</p>')
  assert.equal(find(html, 'phone_published'), 'absent')
})

// ── Contact form ────────────────────────────────────────────────────────────

test('a form with a message field is a contact form', () => {
  const html = realPage('<form action="/send"><input name="name"><textarea name="message"></textarea></form>')
  assert.equal(find(html, 'contact_form'), 'present')
})

test('a search box is not a contact form', () => {
  for (const html of [
    realPage('<form role="search"><input type="text" name="q"></form>'),
    realPage('<form action="/search"><input type="text" name="query"></form>'),
    realPage('<form><input type="search" name="s"></form>'),
  ]) {
    assert.equal(find(html, 'contact_form'), 'absent', html)
  }
})

test('a search form does not mask a real contact form elsewhere on the page', () => {
  const html = realPage(`<form role="search"><input type="search" name="s"></form>
    <form action="/contact"><input type="email" name="email"></form>`)
  assert.equal(find(html, 'contact_form'), 'present')
})

test('an embedded third-party form counts', () => {
  // Its markup arrives client-side, so matching the script host is the only honest way to see it.
  const html = realPage('<div class="hbspt-form"></div><script src="//js.hsforms.net/forms/v2.js"></script>')
  assert.equal(find(html, 'contact_form'), 'present')
})

// ── Hours ───────────────────────────────────────────────────────────────────

test('schema.org opening hours count', () => {
  const html = realPage(`<script type="application/ld+json">
    {"@type":"LocalBusiness","openingHours":"Mo-Fr 08:00-17:00"}</script>`)
  assert.equal(find(html, 'hours_published'), 'present')
})

test('a day and a time together are published hours', () => {
  const html = realPage('<p>Open Monday to Friday, 8:00 am to 5:00 pm</p>')
  assert.equal(find(html, 'hours_published'), 'present')
})

test('a day name alone is not opening hours', () => {
  // A blog date must not be read as a business being open.
  const html = realPage('<p>Posted on Monday by our team. Roof repair tips.</p>')
  assert.equal(find(html, 'hours_published'), 'absent')
})

// ── After-hours affordance ──────────────────────────────────────────────────

test('an after-hours promise is recognised in its common forms', () => {
  for (const claim of ['24/7 emergency service', 'Open 24 hours', 'after-hours callout',
                       'We are available around the clock']) {
    const html = realPage(`<p>${claim}</p>`)
    assert.equal(find(html, 'after_hours'), 'present', claim)
  }
})

test('an ordinary page makes no after-hours promise', () => {
  const html = realPage('<p>Quality roofing since 2010. Call for a quote.</p>')
  assert.equal(find(html, 'after_hours'), 'absent')
})

// ── Viewport and weight ─────────────────────────────────────────────────────

test('the viewport tag is detected', () => {
  const yes = realPage('<p>x</p>').replace('<head>', '<head><meta name="viewport" content="width=device-width">')
  assert.equal(find(yes, 'mobile_viewport'), 'present')
  assert.equal(find(realPage('<p>x</p>'), 'mobile_viewport'), 'absent')
})

test('html weight states what was actually measured', () => {
  const html = realPage('<p>' + 'x'.repeat(60_000) + '</p>')
  const o = analysePage(page(html)).observations.find(x => x.id === 'html_weight')!
  assert.equal(o.finding, 'present')
  // The claim must not overstate itself as whole-page weight — images and scripts were not fetched.
  assert.match(o.sentence, /before images, fonts or scripts/)
  assert.match(o.sentence, /59 KB/)
})

// ── The governing rule ──────────────────────────────────────────────────────

test('no observation is ever a score', () => {
  const html = realPage(`<a href="tel:+18175551212">Call</a>
    <form><textarea name="message"></textarea></form>
    <p>Open Monday to Friday 8:00 am to 5:00 pm. 24/7 emergency service.</p>`)
    .replace('<head>', '<head><meta name="viewport" content="width=device-width">')
  const a = analysePage(page(html))
  assert.equal(a.reportable, true)
  for (const o of a.observations) {
    assert.doesNotMatch(o.sentence, /\b\d{1,3}\s*\/\s*100\b|score|rating|grade/i, o.sentence)
  }
  // Every check found something on a page that has everything.
  assert.equal(a.observations.filter(o => o.finding === 'present').length, a.observations.length)
})

test('every reportable observation carries a sentence a prospect can verify', () => {
  const html = realPage('<p>Call today for a free estimate.</p>')
  for (const o of reportable(analysePage(page(html)))) {
    assert.ok(o.sentence.length > 0)
    assert.match(o.sentence, /\.$/, `should read as a sentence: ${o.sentence}`)
  }
})

// ── A bouncer is not their homepage ─────────────────────────────────────────
// Found by running this against real sites: the project's own test client,
// Northsideroofing.com, serves 114 bytes of JavaScript redirect. Analysing it produced six
// confident negatives about a page the prospect has never seen.

const STUB = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'

test('a redirect stub is not reportable', () => {
  const a = analysePage(page(STUB))
  assert.equal(a.reportable, false)
  assert.equal(a.unreportable, 'no_content')
  assert.deepEqual(a.observations, [])
  assert.equal(a.redirectHint, '/lander')
})

test('redirect targets are read from all the usual shapes', () => {
  assert.equal(redirectTarget(STUB), '/lander')
  assert.equal(redirectTarget('<meta http-equiv="refresh" content="0;url=/home">'), '/home')
  assert.equal(redirectTarget('<script>location.replace("https://x.com/a")</script>'), 'https://x.com/a')
  assert.equal(redirectTarget('<html><body><p>a real page</p></body></html>'), null)
})

test('a real homepage is never mistaken for a bouncer', () => {
  assert.equal(looksContentless(realPage('<p>Call us</p>')), false)
  assert.equal(looksContentless(STUB), true)
})

test('a sparse but real page still gets its observations', () => {
  // Over-firing the contentless guard silently deletes a whole dossier section, so it must key on
  // the bouncer signal rather than merely on being short.
  const sparse = '<html><body><h1>Bobs Plumbing</h1><img src="/logo.png">' +
                 '<a href="tel:+18175551212">817-555-1212</a></body></html>'
  assert.equal(looksContentless(sparse), false)
  assert.equal(find(sparse, 'phone_published'), 'present')
})

// ── The contact-form trap ───────────────────────────────────────────────────
// Also found on real sites: a lone <input type="email"> matched as a "contact form" on
// homedepot.com and stripe.com, where it is a newsletter signup.

test('a newsletter signup is not a contact form', () => {
  const html = realPage('<form class="newsletter-signup"><input type="email" name="email"></form>')
  assert.equal(find(html, 'contact_form'), 'absent')
})

test('an unlabelled email box is undetermined, not a contact form', () => {
  // Under-claiming beats guessing: "your homepage carries a contact form" is checkable in one
  // glance, and being wrong about it costs the prospect's trust in every other line.
  const html = realPage('<form><input type="email" name="email"></form>')
  const o = analysePage(page(html)).observations.find(x => x.id === 'contact_form')!
  assert.equal(o.finding, 'undetermined')
  assert.equal(o.sentence, '')
})

test('a form that says what it is for counts', () => {
  const html = realPage('<form action="/request-a-quote"><input type="email" name="email"></form>')
  assert.equal(find(html, 'contact_form'), 'present')
})

test('sub-kilobyte HTML does not read as "0 KB"', () => {
  const html = realPage('<p>Small page</p>')
  const o = analysePage(page(html, { bytes: 400 })).observations.find(x => x.id === 'html_weight')!
  assert.match(o.sentence, /under 1 KB/)
})
