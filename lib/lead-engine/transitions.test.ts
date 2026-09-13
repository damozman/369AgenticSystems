/**
 * `canTransition` — which status changes are legal.
 *
 * Exhaustive over every ordered pair rather than spot-checked, because the failure this guards
 * against is a status becoming publishable by accident. Adding a seventh status, or an arrow to an
 * existing one, will fail the table below and force the decision to be made deliberately.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { canTransition } from '@/lib/lead-engine/site'
import { SITE_STATUSES, type SiteStatus } from '@/lib/lead-engine/types'

/** Every pair that must be allowed. Anything absent must be refused. */
const LEGAL: ReadonlyArray<[SiteStatus, SiteStatus]> = [
  ['draft', 'live'],
  ['awaiting_answers', 'live'],
  ['in_build', 'live'],
  ['live', 'suspended'],
  ['live', 'in_build'],
  ['suspended', 'live'],
]

test('every legal transition is allowed', () => {
  for (const [from, to] of LEGAL) {
    assert.ok(canTransition(from, to), `${from} -> ${to} should be allowed`)
  }
})

test('EVERY other ordered pair is refused', () => {
  const legal = new Set(LEGAL.map(([f, t]) => `${f}->${t}`))
  for (const from of SITE_STATUSES) {
    for (const to of SITE_STATUSES) {
      if (legal.has(`${from}->${to}`)) continue
      assert.equal(canTransition(from, to), false, `${from} -> ${to} should be refused`)
    }
  }
})

test('cancelled is unreachable in BOTH directions', () => {
  // Nothing in the product cancels a site. Inventing the transition would mean guessing what it
  // should do to a URL a customer is handing out, so it stays a dead end until someone decides.
  for (const s of SITE_STATUSES) {
    assert.equal(canTransition(s, 'cancelled'), false, `${s} -> cancelled`)
    assert.equal(canTransition('cancelled', s), false, `cancelled -> ${s}`)
  }
})

test('suspend is reversible — a takedown must not be a one-way door', () => {
  assert.ok(canTransition('live', 'suspended'))
  assert.ok(canTransition('suspended', 'live'))
})

test('a site cannot be suspended before it has ever been live', () => {
  // Suspension is a takedown of a public page. Applying it to a site nobody can reach yet would
  // record a state the customer was never in.
  assert.equal(canTransition('draft', 'suspended'), false)
  assert.equal(canTransition('in_build', 'suspended'), false)
})

test('no status transitions to itself — the caller handles idempotence', () => {
  // setSiteStatus short-circuits from === to and reports alreadyInStatus, so the table itself does
  // not need to encode it. If it did, "already live" and "just published" would be the same answer.
  for (const s of SITE_STATUSES) {
    assert.equal(canTransition(s, s), false, `${s} -> ${s}`)
  }
})
