import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideReadiness, readyToBuild, canSend, nudgeSummary,
  BUILD_WITHOUT_CALLS_AFTER_MS, type QueueCandidate,
} from '@/lib/dossier-queue'

const NOW = new Date('2026-08-24T18:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

const cand = (over: Partial<QueueCandidate> = {}): QueueCandidate => ({
  auditId: 'a1',
  submittedAt: ago(30 * 60_000),
  email: 'someone@example.com',
  calls: [{ status: 'scheduled', slot: 'business' }, { status: 'scheduled', slot: 'evening' }],
  alreadyQueued: false,
  ...over,
})

test('one resolved call is enough — the dossier is never held for the second', () => {
  // A prospect who hears nothing until the next morning has already moved on.
  const c = cand({ calls: [{ status: 'resolved', slot: 'business' }, { status: 'scheduled', slot: 'evening' }] })
  assert.equal(decideReadiness(c, NOW).ready, true)
})

test('nothing settled yet means wait', () => {
  const d = decideReadiness(cand(), NOW)
  assert.equal(d.ready, false)
  assert.equal(d.reason, 'awaiting_first_call')
})

test('a failed call still releases the dossier', () => {
  // Our infrastructure failing must not cost the prospect the rest of the report; section 2 is
  // simply omitted.
  const c = cand({ calls: [{ status: 'failed', slot: 'business' }] })
  assert.equal(decideReadiness(c, NOW).ready, true)
})

test('a cancelled call releases it too', () => {
  // Someone who opted out still gets what they asked for, minus the call.
  const c = cand({ calls: [{ status: 'cancelled', slot: 'business' }] })
  assert.equal(decideReadiness(c, NOW).ready, true)
})

test('with calling switched off it builds once the wait elapses', () => {
  const young = cand({ calls: [], submittedAt: ago(10 * 60_000) })
  assert.equal(decideReadiness(young, NOW).ready, false)
  assert.equal(decideReadiness(young, NOW).reason, 'too_soon')

  const old = cand({ calls: [], submittedAt: ago(BUILD_WITHOUT_CALLS_AFTER_MS + 60_000) })
  assert.equal(decideReadiness(old, NOW).ready, true)
})

test('a submission with no address is never queued', () => {
  // Building one we cannot deliver only fills the queue a human has to clear.
  for (const email of [null, '', 'not-an-email']) {
    const d = decideReadiness(cand({ email }), NOW)
    assert.equal(d.ready, false)
    assert.equal(d.reason, 'no_email')
  }
})

test('a submission already queued is never queued twice', () => {
  const d = decideReadiness(cand({ alreadyQueued: true, calls: [{ status: 'resolved', slot: 'business' }] }), NOW)
  assert.equal(d.ready, false)
  assert.equal(d.reason, 'already_queued')
})

test('an unparseable submission time does not read as ancient', () => {
  // "Not a date" must never mean "old enough to send".
  const d = decideReadiness(cand({ submittedAt: 'whenever', calls: [] }), NOW)
  assert.equal(d.ready, false)
})

test('readyToBuild filters rather than throwing', () => {
  const out = readyToBuild([
    cand({ auditId: 'a1', calls: [{ status: 'resolved', slot: 'business' }] }),
    cand({ auditId: 'a2' }),
    cand({ auditId: 'a3', email: null }),
  ], NOW)
  assert.deepEqual(out.map(c => c.auditId), ['a1'])
})

// ── The send gate ───────────────────────────────────────────────────────────

test('an approved dossier with content can be sent', () => {
  assert.deepEqual(canSend({ status: 'approved', to_email: 'a@b.com', html: '<p>x</p>' }), { ok: true })
})

test('a dossier is never sent twice', () => {
  assert.equal(canSend({ status: 'sent', to_email: 'a@b.com', html: '<p>x</p>' }).ok, false)
  assert.equal(
    canSend({ status: 'approved', to_email: 'a@b.com', html: '<p>x</p>', sent_at: NOW.toISOString() }).ok,
    false)
})

test('a declined dossier cannot be sent by a stale link', () => {
  const r = canSend({ status: 'declined', to_email: 'a@b.com', html: '<p>x</p>' })
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.reason, 'not_pending')
})

test('an empty or address-less dossier is refused', () => {
  assert.equal(canSend({ status: 'approved', to_email: 'a@b.com', html: '   ' }).ok, false)
  assert.equal(canSend({ status: 'approved', to_email: null, html: '<p>x</p>' }).ok, false)
})

// ── The nudge ───────────────────────────────────────────────────────────────

test('an empty queue produces no nudge', () => {
  assert.equal(nudgeSummary([], NOW), null)
})

test('the nudge names the count AND the age of the oldest', () => {
  // "3 waiting" is ignorable. "3 waiting, oldest 4 days" is not — and a queue nobody clears is
  // where this dies.
  const s = nudgeSummary([
    { built_at: ago(4 * 86_400_000) },
    { built_at: ago(60_000) },
    { built_at: ago(2 * 86_400_000) },
  ], NOW)!
  assert.match(s, /3 dossiers are waiting/)
  assert.match(s, /4 days/)
})

test('singular reads properly', () => {
  const s = nudgeSummary([{ built_at: ago(60_000) }], NOW)!
  assert.match(s, /1 dossier is waiting/)
  assert.match(s, /arrived today/)
})
