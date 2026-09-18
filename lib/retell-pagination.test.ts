import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectPages } from '@/lib/retell-pagination'

/** A fake endpoint over `n` items, served `size` at a time with real-shaped cursors. */
function endpoint(n: number, size: number) {
  const calls: Array<string | undefined> = []
  const fn = async (key: string | undefined) => {
    calls.push(key)
    const start = key ? Number(key) : 0
    const end = Math.min(start + size, n)
    const items = Array.from({ length: end - start }, (_, i) => start + i)
    return end < n ? { items, has_more: true, pagination_key: String(end) } : { items, has_more: false }
  }
  return { fn, calls }
}

test('a single page comes back whole', async () => {
  const e = endpoint(3, 50)
  assert.deepEqual(await collectPages(e.fn), [0, 1, 2])
  assert.equal(e.calls.length, 1)
})

test('several pages are concatenated in order, following the cursor', async () => {
  const e = endpoint(7, 3)
  assert.deepEqual(await collectPages(e.fn), [0, 1, 2, 3, 4, 5, 6])
  assert.deepEqual(e.calls, [undefined, '3', '6'])
})

test('an empty list is empty, not an error', async () => {
  assert.deepEqual(await collectPages(async () => ({ items: [], has_more: false })), [])
})

test('the exact-boundary case: 50 items at page size 50 is one complete page, not a missed second one', async () => {
  const e = endpoint(50, 50)
  assert.equal((await collectPages(e.fn)).length, 50)
  assert.equal(e.calls.length, 1)
})

test('has_more with no pagination_key throws rather than returning a truncated list', async () => {
  await assert.rejects(collectPages(async () => ({ items: [1], has_more: true })), /no pagination_key/)
})

test('a cursor that never advances throws instead of looping forever', async () => {
  await assert.rejects(
    collectPages(async () => ({ items: [1], has_more: true, pagination_key: 'same' })),
    /cursor is not advancing/,
  )
})

test('a bare array is refused: it means the caller is still on a legacy endpoint', async () => {
  await assert.rejects(collectPages(async () => [1, 2, 3]), /bare array/)
})

test('an error body or garbage is refused, never read as an empty list', async () => {
  await assert.rejects(collectPages(async () => ({ status: 'error', message: 'nope' })), /expected \{ items/)
  await assert.rejects(collectPages(async () => null), /expected \{ items/)
  await assert.rejects(collectPages(async () => 'x'), /expected \{ items/)
})

test('exceeding maxPages throws instead of silently truncating', async () => {
  const e = endpoint(100, 1)
  await assert.rejects(collectPages(e.fn, { maxPages: 5 }), /refusing to return a truncated list/)
})

test('the label names the failing endpoint', async () => {
  await assert.rejects(collectPages(async () => [], { label: 'phone numbers' }), /phone numbers:/)
})
