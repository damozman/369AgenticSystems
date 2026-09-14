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

test('a photo pinned to THIS service leads, ahead of unpinned ones', () => {
  const got = servicePagePhotos(
    [p('a'), p('pinned', { slot: 'service', slotKey: 'Roof replacement' }), p('b')],
    'Roof replacement',
  )
  assert.equal(got.lead?.id, 'pinned')
  assert.deepEqual(got.more.map(x => x.id), ['a', 'b'])
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
