import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergePromptWithContext, CONTEXT_MARKER_START, CONTEXT_MARKER_END } from '@/lib/prompt-merge'

const BASE = 'You are Ava, a receptionist.\n\n## Rules\n- Be brief.'

// The line set-ai-disclosure.mjs appends. Texas TRAIGA — losing it is a compliance failure, and
// the only symptom is its absence.
const BACKSTOP = '\nIf a caller asks whether you are a real person, say plainly that you are an AI assistant.\n'

test('a first sync appends the block to a prompt that has none', () => {
  const out = mergePromptWithContext(BASE, 'Hours: 9-5')
  assert.ok(out.startsWith(BASE))
  assert.ok(out.includes('Hours: 9-5'))
  assert.ok(out.includes('BUSINESS_CONTEXT_START'))
})

test('a re-sync replaces the old context rather than stacking a second block', () => {
  const first = mergePromptWithContext(BASE, 'Hours: 9-5')
  const second = mergePromptWithContext(first, 'Hours: 8-6')

  assert.ok(second.includes('Hours: 8-6'))
  assert.ok(!second.includes('Hours: 9-5'), 'stale context must not survive')
  assert.equal(second.split('BUSINESS_CONTEXT_START').length - 1, 1, 'exactly one block')
  assert.ok(second.startsWith(BASE), 'the base prompt is untouched')
})

test('a line appended AFTER the block survives the next sync', () => {
  // This is the regression. A client edits their hours months after a compliance script ran, and
  // the sync used to slice from the marker to the end of the string — deleting the line.
  const withContext = mergePromptWithContext(BASE, 'Hours: 9-5')
  const withBackstop = withContext + BACKSTOP

  const resynced = mergePromptWithContext(withBackstop, 'Hours: 8-6')

  assert.ok(resynced.includes(BACKSTOP.trim()), 'the appended compliance line must survive')
  assert.ok(resynced.includes('Hours: 8-6'), 'and the new context still applies')
  assert.ok(!resynced.includes('Hours: 9-5'))
})

test('trailing content survives repeated syncs, not just the first', () => {
  let prompt = mergePromptWithContext(BASE, 'v1') + BACKSTOP
  for (const v of ['v2', 'v3', 'v4']) prompt = mergePromptWithContext(prompt, v)

  assert.ok(prompt.includes(BACKSTOP.trim()))
  assert.ok(prompt.includes('v4'))
  assert.ok(!prompt.includes('v3'))
  assert.equal(prompt.split('BUSINESS_CONTEXT_START').length - 1, 1)
})

test('content before the block is never disturbed', () => {
  const out = mergePromptWithContext(mergePromptWithContext(BASE, 'a'), 'b')
  assert.equal(out.slice(0, BASE.length), BASE)
})

test('a malformed block with no END marker is replaced, not preserved forever', () => {
  // Truncating here is deliberate: without an END marker there is no way to tell where the
  // context stops and appended text begins, and carrying the remainder would grow the prompt on
  // every sync. The old behaviour is the safe reading of a corrupted prompt.
  const malformed = `${BASE}${CONTEXT_MARKER_START}half a context block, no end`
  const out = mergePromptWithContext(malformed, 'fresh')

  assert.ok(out.includes('fresh'))
  assert.ok(!out.includes('half a context block'))
  assert.ok(out.trimEnd().endsWith(CONTEXT_MARKER_END.trim()))
})

test('an empty context section still produces a well-formed block', () => {
  const out = mergePromptWithContext(BASE, '')
  assert.ok(out.includes('BUSINESS_CONTEXT_START'))
  assert.ok(out.includes('BUSINESS_CONTEXT_END'))
  // And it round-trips: the next sync must still find and replace it.
  const again = mergePromptWithContext(out, 'real context')
  assert.ok(again.includes('real context'))
  assert.equal(again.split('BUSINESS_CONTEXT_START').length - 1, 1)
})
