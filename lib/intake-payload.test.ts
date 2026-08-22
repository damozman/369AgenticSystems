import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  numberFrom, monthlyVolumeFrom, avgJobValueFrom, painPointsFrom,
  MAX_MONTHLY_VOLUME, MAX_AVG_JOB_VALUE,
} from '@/lib/intake-payload'

test('reads the number out of what people actually type', () => {
  assert.equal(monthlyVolumeFrom('120'), 120)
  assert.equal(monthlyVolumeFrom('~60/mo'), 60)
  assert.equal(monthlyVolumeFrom('about 150 a month'), 150)
  assert.equal(avgJobValueFrom('$8,200'), 8200)
  assert.equal(avgJobValueFrom('8200.50'), 8200.5)
  assert.equal(avgJobValueFrom(2500), 2500)
})

test('a value it cannot read is null, never a guess', () => {
  // The dossier omits a section it has no number for. It must never estimate one, which is
  // exactly what the Gumloop dossier did when it scored every business it saw at 41.
  for (const junk of ['', '   ', 'lots', 'a few dozen', 'n/a', null, undefined, {}, []]) {
    assert.equal(monthlyVolumeFrom(junk), null, `expected null for ${JSON.stringify(junk)}`)
    assert.equal(avgJobValueFrom(junk), null, `expected null for ${JSON.stringify(junk)}`)
  }
})

test('out of range is null rather than clamped', () => {
  // Clamping would invent a figure the prospect did not give, and a silently capped number is
  // worse than no number because nothing downstream can tell it was capped.
  assert.equal(monthlyVolumeFrom(MAX_MONTHLY_VOLUME + 1), null)
  assert.equal(avgJobValueFrom(MAX_AVG_JOB_VALUE + 1), null)
  assert.equal(monthlyVolumeFrom('-5'), null)
  assert.equal(avgJobValueFrom('-0.01'), null)
  // A long paste must not overflow the column and fail the insert, which would cost the lead.
  assert.equal(avgJobValueFrom('9'.repeat(40)), null)
  // The boundary itself is usable.
  assert.equal(monthlyVolumeFrom(MAX_MONTHLY_VOLUME), MAX_MONTHLY_VOLUME)
})

test('volume is an integer and value keeps two decimals', () => {
  assert.equal(monthlyVolumeFrom('60.5'), 61)   // INTEGER column
  assert.equal(avgJobValueFrom('19.999'), 20)   // NUMERIC(12,2)
  assert.equal(avgJobValueFrom('19.994'), 19.99)
})

test('numberFrom respects the ceiling it is given', () => {
  assert.equal(numberFrom('500', 100), null)
  assert.equal(numberFrom('50', 100), 50)
})

test('pain points keep form order and drop duplicates', () => {
  assert.deepEqual(
    painPointsFrom({ pain_points: ['speed', 'afterhours', 'speed', 'tracking'] }),
    ['speed', 'afterhours', 'tracking'],
  )
})

test('the old single-value shape still submits', () => {
  // A browser holding a cached copy of a page keeps posting `pain` long after the deploy. A lead
  // is worth more than a tidy contract.
  assert.deepEqual(painPointsFrom({ pain: 'afterhours' }), ['afterhours'])
  assert.deepEqual(painPointsFrom({ pain: null }), [])
  assert.deepEqual(painPointsFrom({}), [])
})

test('junk in the array is skipped, not stored', () => {
  assert.deepEqual(
    painPointsFrom({ pain_points: ['speed', '', '   ', 42, null, { a: 1 }, 'tracking'] }),
    ['speed', 'tracking'],
  )
})

test('an oversized array and oversized values are bounded', () => {
  const many = Array.from({ length: 40 }, (_, i) => `p${i}`)
  assert.equal(painPointsFrom({ pain_points: many }).length, 12)
  assert.equal(painPointsFrom({ pain_points: ['x'.repeat(200)] })[0].length, 60)
})
