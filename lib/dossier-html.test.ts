import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDossier } from '@/lib/dossier'
import { renderDossierEmail, dossierSubject } from '@/lib/dossier-html'

const base = {
  company: 'Verify Roofing Co', name: 'Chris Mosley', serviceArea: 'Fort Worth, TX',
  vertical: 'roofing', painPoints: ['afterhours'], avgJobValue: 8200,
}

test('a prospect-supplied string cannot inject markup', () => {
  // Company name and service area are typed into a public form by strangers.
  const html = renderDossierEmail(buildDossier({
    ...base,
    company: '<script>alert(1)</script>',
    serviceArea: '"><img src=x onerror=alert(1)>',
  }))
  // What matters is that no TAG survives, not that the characters are gone. `onerror=alert(1)`
  // as literal text inside an entity-encoded string is inert — asserting its absence would be
  // testing the wrong thing and would fail on correct output.
  assert.ok(!html.includes('<script>'), 'no raw script tag')
  assert.ok(!html.includes('<img'), 'no raw img tag')
  // And the payload is present, entity-encoded, so it still reads back to the prospect as typed.
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('&lt;img src=x'))
})

test('the subject names the business when we have it', () => {
  assert.match(dossierSubject(buildDossier(base)), /Verify Roofing Co/)
  assert.match(dossierSubject(buildDossier({ avgJobValue: 100 })), /your line/)
})

test('the figure and its assumption travel together', () => {
  // A number that escapes its caveat is how a conservative estimate becomes a claim.
  const html = renderDossierEmail(buildDossier(base))
  const figureAt = html.indexOf('$2,460')
  const noteAt = html.indexOf('conservative rate')
  assert.ok(figureAt > 0 && noteAt > figureAt, 'the note must follow the figure in the markup')
})

test('an omitted section leaves no empty heading behind', () => {
  const html = renderDossierEmail(buildDossier({ company: 'Solo Co' }))
  assert.ok(!html.includes('We called your line'))
  assert.ok(!html.includes('What we found on your website'))
  assert.ok(html.includes('What you told us'))
})

test('email HTML only — no script, no external assets, no stylesheet block', () => {
  const html = renderDossierEmail(buildDossier(base))
  assert.ok(!/<script/i.test(html))
  assert.ok(!/<style/i.test(html))
  assert.ok(!/<img/i.test(html))
  // The one external URL is our own booking link.
  const urls = html.match(/https?:\/\/[^"']+/g) ?? []
  assert.ok(urls.every(u => u.startsWith('https://369agenticsystems.com')), urls.join(' '))
})

test('sections are numbered in the order they survived', () => {
  const html = renderDossierEmail(buildDossier({ company: 'Solo Co' }))
  assert.ok(html.includes('>01<'))
  assert.ok(html.includes('>02<'))
  assert.ok(!html.includes('>03<'))
})
