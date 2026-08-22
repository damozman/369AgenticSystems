/**
 * Runs the website measurement module against REAL websites.
 *
 * `lib/website-audit.test.ts` proves the logic against fixtures. This proves the regexes survive
 * markup nobody on this project wrote, which is a different question — and it is the one that
 * found both of the module's real defects within a minute of first running:
 *
 *   1. **Northsideroofing.com serves 114 bytes of JavaScript redirect.** The module read that stub
 *      and produced six confident negatives — no phone, no form, no hours, no viewport — about a
 *      page the prospect has never seen. Now `no_content`, with the redirect target named.
 *   2. **A lone `<input type="email">` matched as a "contact form"** on homedepot.com and
 *      stripe.com, where it is a newsletter signup. Now it has to carry a message field or say
 *      what it is for, and an unlabelled email box is `undetermined` rather than a guess.
 *
 * Neither was visible in a fixture, because fixtures are written by whoever writes the check.
 *
 * Read-only: HTTP GETs against public homepages, nothing written anywhere. Safe to run anytime.
 *
 * node --import ./scripts/test-resolver.mjs scripts/verify-website-audit.mjs
 * Add any URL as an argument to check one site: ... scripts/verify-website-audit.mjs example.com
 */
import { fetchHomepage, reportable } from '../lib/website-audit.ts'

/** A spread of real shapes: our own site, a parked stub, a big retailer, a small trade, an SPA-ish
 *  marketing site, a dead domain, and the blank the intake form allows. */
const DEFAULT_SITES = [
  'https://369agenticsystems.com',
  'www.Northsideroofing.com',
  'https://www.homedepot.com',
  'https://www.rothroofing.com',
  'https://stripe.com',
  'https://this-domain-does-not-exist-369.com',
  '',
]

const sites = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SITES
const MARK = { present: '+', absent: '-', undetermined: '?' }

let unreportable = 0

for (const site of sites) {
  const a = await fetchHomepage(site)
  console.log(`\n── ${site || '(blank website field)'}`)

  if (!a.reportable) {
    unreportable++
    console.log(`   NOT REPORTABLE (${a.unreportable}) — the dossier omits this section`)
    console.log(`   ${a.detail}`)
    continue
  }

  console.log(`   ${a.detail}${a.clientRendered ? '  [client-rendered]' : ''}`)
  for (const o of a.observations) {
    const ev = o.evidence ? `   [${o.evidence.slice(0, 64)}]` : ''
    console.log(`   ${MARK[o.finding]} ${o.id.padEnd(17)} ${o.sentence || '(withheld)'}${ev}`)
  }
  console.log(`   → ${reportable(a).length} of ${a.observations.length} shown to the prospect`)
}

console.log(
  `\n${sites.length} site(s) checked · ${unreportable} produced nothing reportable.\n` +
  `Read every "-" line as if you were the business owner: a negative you cannot instantly\n` +
  `verify on your own homepage is a bug, not a finding.`)
