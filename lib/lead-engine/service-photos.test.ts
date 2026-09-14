/**
 * `servicePagePhotos` — what a service page is allowed to show.
 *
 * The rule that matters most is the one about NOT taking a photo someone placed deliberately.
 * Everything else is ordering.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { servicePagePhotos } from '@/lib/lead-engine/photos'
import type { SitePhoto } from '@/lib/lead-engine/types'

const p = (id: string, extra: Partial<SitePhoto> = {}): SitePhoto =>
  ({ id, url: `/${id}.jpg`, caption: null, ...extra }) as SitePhoto

test('with nothing pinned anywhere, a service page still gets photos', () => {
  const got = servicePagePhotos([p('a'), p('b'), p('c')], 'Roof replacement')
  assert.equal(got.lead?.id, 'a', 'a site on Automatic — which is every site by default — must not render a photoless page')
  assert.deepEqual(got.more.map(x => x.id), ['b', 'c'])
})

test('one tag means a lead and NO strip — nothing automatic is mixed in beside it', () => {
  // Topping the strip up with whatever is spare puts a finished re-roof next to three pictures of
  // hail damage, and hides that only one photo was tagged.
  const got = servicePagePhotos(
    [p('a'), p('tagged', { slot: 'service', slotKey: 'Roof replacement' }), p('b')],
    'Roof replacement',
  )
  assert.equal(got.lead?.id, 'tagged')
  assert.deepEqual(got.more, [])
})

test('several tags on one service fill the lead and the strip, in order', () => {
  const tagged = (id) => p(id, { slot: 'service', slotKey: 'Roof replacement' })
  const got = servicePagePhotos(
    [p('spare'), tagged('t1'), tagged('t2'), tagged('t3'), tagged('t4')],
    'Roof replacement',
  )
  assert.equal(got.lead?.id, 't1')
  assert.deepEqual(got.more.map(x => x.id), ['t2', 't3', 't4'])
})

test('two services with tags show entirely different photographs', () => {
  const all = [
    p('roof1', { slot: 'service', slotKey: 'Roof replacement' }),
    p('roof2', { slot: 'service', slotKey: 'Roof replacement' }),
    p('storm1', { slot: 'service', slotKey: 'Storm damage repair' }),
    p('storm2', { slot: 'service', slotKey: 'Storm damage repair' }),
  ]
  const roof = servicePagePhotos(all, 'Roof replacement', { serviceIndex: 0 })
  const storm = servicePagePhotos(all, 'Storm damage repair', { serviceIndex: 1 })

  const ids = (r) => [r.lead?.id, ...r.more.map(x => x.id)].filter(Boolean)
  assert.deepEqual(ids(roof), ['roof1', 'roof2'])
  assert.deepEqual(ids(storm), ['storm1', 'storm2'])
})

test('untagged services still differ from each other', () => {
  const free = Array.from({ length: 8 }, (_, i) => p(`f${i}`))
  const a = servicePagePhotos(free, 'A', { serviceIndex: 0 })
  const b = servicePagePhotos(free, 'B', { serviceIndex: 1 })
  assert.notEqual(a.lead?.id, b.lead?.id, 'two service pages opening with the same image reads as a template')
})

test('name matching ignores case and surrounding space, like every other slot match', () => {
  const got = servicePagePhotos(
    [p('x', { slot: 'service', slotKey: '  roof REPLACEMENT ' })],
    'Roof replacement',
  )
  assert.equal(got.lead?.id, 'x')
})

test('it never borrows a photo an operator placed somewhere else', () => {
  const got = servicePagePhotos([
    p('hero', { slot: 'hero' }),
    p('band', { slot: 'band' }),
    p('gallery', { slot: 'gallery' }),
    p('other', { slot: 'service', slotKey: 'Gutter installation' }),
  ], 'Roof replacement')

  assert.equal(got.lead, undefined, 'every photo here is spoken for — no page is worth overriding a person')
  assert.deepEqual(got.more, [])
})

test('the marked hero is left alone even with no slot set', () => {
  const got = servicePagePhotos([p('primary', { isPrimary: true }), p('free')], 'Roof replacement')
  assert.equal(got.lead?.id, 'free')
  assert.deepEqual(got.more, [])
})

test('the strip is capped, and the cap is caller-settable', () => {
  const many = Array.from({ length: 10 }, (_, i) => p(`p${i}`))
  assert.equal(servicePagePhotos(many, 'X').more.length, 3)
  assert.equal(servicePagePhotos(many, 'X', { more: 5 }).more.length, 5)
  assert.equal(servicePagePhotos(many, 'X', { more: 0 }).more.length, 0)
})

test('no photos at all is a normal answer, not a crash', () => {
  assert.deepEqual(servicePagePhotos([], 'X'), { more: [] })
})
