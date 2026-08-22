import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  auditCallsEnabled, decideOne, decideBatch, toPlace, summarise,
  MAX_LATENESS_MS, type ScheduledCall,
} from '@/lib/audit-dispatch'

const ON = { AUDIT_CALLS_ENABLED: 'true' } as NodeJS.ProcessEnv
const NOW = new Date('2026-08-24T15:30:00Z')

const call = (over: Partial<ScheduledCall> = {}): ScheduledCall => ({
  id: 'c1',
  audit_id: 'a1',
  slot: 'business',
  scheduled_for: NOW.toISOString(),
  status: 'scheduled',
  target_phone: '+18175551212',
  call_id: null,
  ...over,
})

// ── The switch ──────────────────────────────────────────────────────────────

test('the switch must be exactly "true"', () => {
  // 'false', '0' and 'no' are all truthy strings. A switch that turns itself on when someone
  // writes AUDIT_CALLS_ENABLED=false is worse than no switch.
  for (const v of ['false', '0', 'no', 'TRUE', 'True', 'yes', '1', '', undefined]) {
    assert.equal(auditCallsEnabled({ AUDIT_CALLS_ENABLED: v } as NodeJS.ProcessEnv), false, String(v))
  }
  assert.equal(auditCallsEnabled(ON), true)
})

test('nothing is placed while the switch is off', () => {
  // The disclosure is not on the intake form yet. Calling someone who was never told is the
  // version that costs a customer.
  const d = decideOne(call(), NOW, {} as NodeJS.ProcessEnv)
  assert.equal(d.place, false)
  assert.equal(d.reason, 'disabled')
})

test('off means off even for a perfectly due call', () => {
  const decisions = decideBatch([call(), call({ id: 'c2', slot: 'evening' })], NOW, {} as NodeJS.ProcessEnv)
  assert.equal(toPlace(decisions).length, 0)
})

// ── Timing ──────────────────────────────────────────────────────────────────

test('a call whose time has come is placed', () => {
  assert.equal(decideOne(call(), NOW, ON).place, true)
})

test('a call in the future is not placed', () => {
  const future = new Date(NOW.getTime() + 60 * 60_000).toISOString()
  const d = decideOne(call({ scheduled_for: future }), NOW, ON)
  assert.equal(d.place, false)
  assert.equal(d.reason, 'not_due')
})

test('a stale call is abandoned rather than placed late', () => {
  // A cron down for a day must not wake up and dial someone at 3am. A missed audit call costs one
  // section of one dossier; a call at the wrong hour costs the relationship.
  const old = new Date(NOW.getTime() - MAX_LATENESS_MS - 60_000).toISOString()
  const d = decideOne(call({ scheduled_for: old }), NOW, ON)
  assert.equal(d.place, false)
  assert.equal(d.reason, 'too_late')
})

test('a call just inside the lateness window still goes', () => {
  const late = new Date(NOW.getTime() - MAX_LATENESS_MS + 60_000).toISOString()
  assert.equal(decideOne(call({ scheduled_for: late }), NOW, ON).place, true)
})

// ── Never dial twice ────────────────────────────────────────────────────────

test('a call that already has a Retell id is never re-placed', () => {
  const d = decideOne(call({ call_id: 'call_abc' }), NOW, ON)
  assert.equal(d.place, false)
  assert.equal(d.reason, 'already_placed')
})

test('a row past the scheduled state is never re-placed', () => {
  for (const status of ['placed', 'resolved', 'failed']) {
    const d = decideOne(call({ status }), NOW, ON)
    assert.equal(d.place, false, status)
    assert.equal(d.reason, 'already_placed')
  }
})

test('one prospect is never dialled twice in the same run', () => {
  // Both slots can come due together after an outage. Two calls to a stranger inside a minute is
  // a nuisance call, and it destroys the very thing the second call measures.
  const decisions = decideBatch([
    call({ id: 'c1', slot: 'business', scheduled_for: new Date(NOW.getTime() - 60_000).toISOString() }),
    call({ id: 'c2', slot: 'evening' }),
  ], NOW, ON)
  const placing = toPlace(decisions)
  assert.equal(placing.length, 1)
  // The one that has waited longest wins the slot.
  assert.equal(placing[0].id, 'c1')
})

test('different prospects are not throttled against each other', () => {
  const decisions = decideBatch([
    call({ id: 'c1', audit_id: 'a1' }),
    call({ id: 'c2', audit_id: 'a2' }),
    call({ id: 'c3', audit_id: 'a3' }),
  ], NOW, ON)
  assert.equal(toPlace(decisions).length, 3)
})

// ── Bad rows ────────────────────────────────────────────────────────────────

test('a row with nothing dialable is skipped', () => {
  assert.equal(decideOne(call({ target_phone: '   ' }), NOW, ON).reason, 'no_phone')
})

test('a legacy single call is left to the path that owns it', () => {
  assert.equal(decideOne(call({ slot: null }), NOW, ON).reason, 'no_slot')
})

test('an unparseable schedule is not treated as due', () => {
  // "Not a date" must never mean "now".
  assert.equal(decideOne(call({ scheduled_for: 'soon' }), NOW, ON).place, false)
  assert.equal(decideOne(call({ scheduled_for: null }), NOW, ON).place, false)
})

// ── Logging ─────────────────────────────────────────────────────────────────

test('a run that did nothing says why', () => {
  // silence-check selected a column that never existed and failed silently for months because
  // nobody read its output — only that it ran.
  assert.match(summarise(decideBatch([call()], NOW, {} as NodeJS.ProcessEnv)), /disabled=1/)
  assert.match(summarise(decideBatch([call()], NOW, ON)), /placing=1/)
  assert.equal(summarise([]), 'no scheduled audit calls')
})

// ── Suppression: the gate that makes the opt-out honest ─────────────────────

test('a suppressed number is never dialled, however due it is', () => {
  const sup = new Set(['+18175551212'])
  const d = decideOne(call(), NOW, ON, sup)
  assert.equal(d.place, false)
  assert.equal(d.reason, 'suppressed')
})

test('suppression beats timing, not the other way round', () => {
  // Checked before any due/late arithmetic, so no schedule can slip past it.
  const sup = new Set(['+18175551212'])
  const late = new Date(NOW.getTime() - 60_000).toISOString()
  assert.equal(decideOne(call({ scheduled_for: late }), NOW, ON, sup).reason, 'suppressed')
})

test('suppression is applied across a batch', () => {
  const sup = new Set(['+18175551212'])
  const decisions = decideBatch([
    call({ id: 'c1', audit_id: 'a1', target_phone: '+18175551212' }),
    call({ id: 'c2', audit_id: 'a2', target_phone: '+18175559999' }),
  ], NOW, ON, sup)
  const placing = toPlace(decisions)
  assert.equal(placing.length, 1)
  assert.equal(placing[0].target_phone, '+18175559999')
})

test('an empty suppression list changes nothing', () => {
  assert.equal(decideOne(call(), NOW, ON, new Set()).place, true)
})

test('the run summary names suppression, so a silent skip is visible', () => {
  const sup = new Set(['+18175551212'])
  assert.match(summarise(decideBatch([call()], NOW, ON, sup)), /suppressed=1/)
})
