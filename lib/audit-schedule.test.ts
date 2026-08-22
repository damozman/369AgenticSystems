import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  planAuditCalls, AUDIT_TIME_ZONE,
  BUSINESS_HOUR_START, BUSINESS_HOUR_END,
  EVENING_HOUR_START, EVENING_HOUR_END, MIN_LEAD_MINUTES,
} from '@/lib/audit-schedule'

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: AUDIT_TIME_ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const at = (t: string) => f.find(p => p.type === t)!.value
  return { weekday: at('weekday'), hour: Number(at('hour')), minute: Number(at('minute')) }
}

/** 2026-08-24 is a Monday. Times below are DFW local. */
const monday = (h: number, m = 0) =>
  new Date(new Date(`2026-08-24T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`))

const SEED = 'a1b2c3d4'

test('a morning submission is called in business hours first', () => {
  const s = planAuditCalls(monday(9, 15), SEED)
  assert.equal(s.first.slot, 'business')
  assert.equal(s.second.slot, 'evening')
})

test('an evening submission flips the order', () => {
  // The sequence adapts; the shape does not.
  const s = planAuditCalls(monday(19, 30), SEED)
  assert.equal(s.first.slot, 'evening')
  assert.equal(s.second.slot, 'business')
})

test('both calls land inside their stated windows', () => {
  for (const submitted of [monday(8), monday(11), monday(15), monday(19), monday(23)]) {
    const s = planAuditCalls(submitted, SEED)
    const biz = [s.first, s.second].find(c => c.slot === 'business')!
    const eve = [s.first, s.second].find(c => c.slot === 'evening')!
    const bh = parts(biz.at).hour
    const eh = parts(eve.at).hour
    assert.ok(bh >= BUSINESS_HOUR_START && bh < BUSINESS_HOUR_END, `business hour ${bh}`)
    assert.ok(eh >= EVENING_HOUR_START && eh < EVENING_HOUR_END, `evening hour ${eh}`)
  }
})

test('nobody is ever called at 3am', () => {
  for (let h = 0; h < 24; h++) {
    const s = planAuditCalls(monday(h), SEED)
    for (const call of [s.first, s.second]) {
      const hour = parts(call.at).hour
      assert.ok(hour >= BUSINESS_HOUR_START && hour < EVENING_HOUR_END,
        `submitted ${h}:00 -> call at ${hour}:00`)
    }
  }
})

test('no call is placed before the minimum lead time', () => {
  // Instant is uncanny, not responsive.
  const submitted = monday(10, 30)
  const s = planAuditCalls(submitted, SEED)
  const earliest = submitted.getTime() + MIN_LEAD_MINUTES * 60_000
  assert.ok(s.first.at.getTime() >= earliest)
  assert.ok(s.second.at.getTime() >= earliest)
})

test('calls only land on weekdays', () => {
  // Calling a roofer at 11am on a Sunday and reporting "nobody answered" would be a finding about
  // the day of the week, not about how they handle calls.
  const saturday = new Date('2026-08-22T11:00:00-05:00')
  const sunday = new Date('2026-08-23T11:00:00-05:00')
  for (const submitted of [saturday, sunday]) {
    const s = planAuditCalls(submitted, SEED)
    for (const call of [s.first, s.second]) {
      const day = parts(call.at).weekday
      assert.ok(!['Sat', 'Sun'].includes(day), `${submitted.toISOString()} -> ${day}`)
    }
  }
})

test('the dossier goes out after the FIRST call, never held for the second', () => {
  // A prospect who hears nothing until the next morning has already moved on.
  const s = planAuditCalls(monday(9, 15), SEED)
  assert.ok(s.dossierAt.getTime() > s.first.at.getTime())
  assert.ok(s.dossierAt.getTime() < s.second.at.getTime())
})

test('the follow-up comes after the second call, in the morning', () => {
  for (const submitted of [monday(9), monday(19)]) {
    const s = planAuditCalls(submitted, SEED)
    assert.ok(s.followUpAt.getTime() > s.second.at.getTime())
    assert.equal(parts(s.followUpAt).hour, 8)
  }
})

test('the schedule is deterministic for a given seed', () => {
  const a = planAuditCalls(monday(9, 15), SEED)
  const b = planAuditCalls(monday(9, 15), SEED)
  assert.equal(a.first.at.getTime(), b.first.at.getTime())
  assert.equal(a.second.at.getTime(), b.second.at.getTime())
})

test('different prospects are not dialled in lockstep', () => {
  // Two submissions in the same minute must not produce the same call minute.
  const a = planAuditCalls(monday(9, 15), 'prospect-one')
  const b = planAuditCalls(monday(9, 15), 'prospect-two')
  assert.notEqual(a.first.at.getTime(), b.first.at.getTime())
})

test('ordering holds across every submission hour', () => {
  for (let h = 0; h < 24; h++) {
    const s = planAuditCalls(monday(h), SEED)
    assert.ok(s.first.at.getTime() <= s.second.at.getTime(), `hour ${h}`)
    assert.notEqual(s.first.slot, s.second.slot)
  }
})
