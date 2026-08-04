import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The guard in /api/capture-lead, kept in sync here.
 *
 * The payloads below are verbatim from production on 2026-08-04 — two real leads landed with
 * tool-call markup in `caller_address` after the demo prompt stopped asking for an address
 * while the tool schema still offered the slot. It happened on two different models, so it is
 * not a quirk of one: it is what an unfillable parameter looks like by the time it reaches the
 * database.
 *
 * The markup tokens are assembled by concatenation rather than written literally, because a
 * literal one truncates the tooling that edits this file.
 */
const TOOL_MARKUP = /<\/?\s*(antml|parameter|invoke|function|tool)[\s:_>=]|<\/[a-z_]+>/i

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (TOOL_MARKUP.test(trimmed)) return undefined
  return trimmed
}

const CLOSE_PARAM = '</' + 'antml_parameter>'
const OPEN_PARAM = (name: string) => '<' + `parameter name="${name}">`

test('the exact payloads that corrupted two real leads are dropped', () => {
  assert.equal(clean(`${CLOSE_PARAM}\n${OPEN_PARAM('caller_phone')}817-729-1944`), undefined)
  assert.equal(clean(`${CLOSE_PARAM}\n${OPEN_PARAM('issue_description')}Interested in a demo`), undefined)
})

test('other shapes of the same leak are dropped too', () => {
  // The failure is a class, not two strings — a guard that only caught the observed pair would
  // pass this file and still let the next variant through.
  for (const junk of [
    OPEN_PARAM('caller_email'),
    '</' + 'invoke>',
    '<' + 'function_calls>',
    CLOSE_PARAM,
    '</' + 'tool_use>',
  ]) {
    assert.equal(clean(junk), undefined, `"${junk}" should not reach the database`)
  }
})

test('real addresses still get through untouched', () => {
  // The guard has to be narrower than "contains a punctuation character". Every one of these is
  // a genuine value from the leads table before the corruption started.
  for (const real of [
    '1112 Main Street, Fort Worth, Texas 76133',
    '5459 Waits Drive, Fort Worth, Texas 76133',
    'East Texas (open to options)',
    '4821 Ridgewood Dr, Fort Worth TX',
    'Suite 200, 892 Creekside Blvd',
  ]) {
    assert.equal(clean(real), real)
  }
})

test('blank and non-string values become undefined, not empty strings', () => {
  // A null address is honest. An empty string looks like an answered question.
  assert.equal(clean(''), undefined)
  assert.equal(clean('   '), undefined)
  assert.equal(clean(undefined), undefined)
  assert.equal(clean(null), undefined)
  assert.equal(clean(42), undefined)
})

test('surrounding whitespace is trimmed rather than stored', () => {
  assert.equal(clean('  Chris Mozley  '), 'Chris Mozley')
})
