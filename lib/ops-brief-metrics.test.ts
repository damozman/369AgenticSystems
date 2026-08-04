import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from './ops-brief-metrics.ts'

/**
 * Both cases here were found by running a deliberately messy wholesale export
 * through the harness in production, not by reading the code. A clean fixture
 * would have passed.
 */

const HEADERS = ['Stat', 'Ordered', 'Shipped Dt', 'Qty Shp', 'OnHand Avg', 'Stk', 'ROP', 'B/O?', 'BO Qty', 'Price Ea']

const map = (over: Record<string, string | null> = {}) => {
  const base: Record<string, string | null> = {
    order_status: 'Stat', order_date: 'Ordered', ship_date: 'Shipped Dt',
    units_sold_or_cogs: 'Qty Shp', avg_inventory_on_hand: 'OnHand Avg',
    current_stock: 'Stk', reorder_point: 'ROP', backorder_status: 'B/O?',
    backorder_quantity: 'BO Qty', unit_price: 'Price Ea',
  }
  return Object.fromEntries(
    Object.entries({ ...base, ...over }).map(([k, v]) => [k, { column: v, confidence: 1 }]),
  ) as never
}

// Stat, Ordered, Shipped Dt, Qty Shp, OnHand Avg, Stk, ROP, B/O?, BO Qty, Price Ea
const rows = (...r: string[][]) => r

test('a Y/N backorder flag is counted — the shape most distribution exports use', () => {
  const report = computeMetrics(HEADERS, rows(
    ['PARTIAL', '07/07/2026', '07/14/2026', '310', '1850', '45', '200', 'Y', '140', '9.55'],
    ['SHIPPED', '07/06/2026', '07/09/2026', '240', '1850', '412', '150', 'N', '0', '18.75'],
  ), map())

  // Only the Y row counts: 140 × 9.55. The N row must not contribute.
  assert.equal(report.backorder_value.value, 1337)
  assert.equal(report.backorder_value.reason, undefined)
})

test('status text still works — the fix widened the check, it did not replace it', () => {
  const report = computeMetrics(HEADERS, rows(
    ['BACKORDER', '07/10/2026', '', '0', '940', '3', '60', 'BACKORDERED', '325', '14.20'],
  ), map())
  assert.equal(report.backorder_value.value, 4615)
})

test('explicit negatives are excluded rather than merely failing to match', () => {
  for (const flag of ['N', 'no', 'FALSE', '0', '-', 'n/a', '']) {
    const report = computeMetrics(HEADERS, rows(
      [ 'OPEN', '07/08/2026', '', '0', '1850', '610', '150', flag, '99', '27.00'],
    ), map())
    assert.equal(report.backorder_value.value, null, `"${flag}" should not count as backordered`)
  }
})

test('stockout counts every qualifying line, including repeats of one SKU', () => {
  // The same SKU (stock 88 / reorder 120) on three separate orders is 3 lines.
  // The metric is labelled "lines", not "SKUs", precisely because the schema
  // carries no SKU column to deduplicate on.
  const line = ['SHIPPED', '07/06/2026', '07/09/2026', '96', '1850', '88', '120', 'N', '0', '42.10']
  const report = computeMetrics(HEADERS, rows(line, line, line), map())
  assert.equal(report.stockout_risk_sku_count.value, 3)
})

test('a line exactly at its reorder point counts — that is what a reorder point is', () => {
  const report = computeMetrics(HEADERS, rows(
    ['SHIPPED', '07/06/2026', '07/09/2026', '96', '1850', '120', '120', 'N', '0', '42.10'],
  ), map())
  assert.equal(report.stockout_risk_sku_count.value, 1)
})

test('blank ship dates are excluded from cycle time, not treated as same-day', () => {
  // 3-day order + an unshipped order. Counting the blank as 0 would give 1.5.
  const report = computeMetrics(HEADERS, rows(
    ['SHIPPED', '07/06/2026', '07/09/2026', '240', '1850', '412', '150', 'N', '0', '18.75'],
    ['OPEN',    '07/08/2026', '',           '0',   '1850', '610', '150', 'N', '0', '27.00'],
  ), map())
  assert.equal(report.avg_order_cycle_time_days.value, 3)
})

test('an unmapped required column reports why instead of throwing', () => {
  const report = computeMetrics(HEADERS, rows(
    ['PARTIAL', '07/07/2026', '07/14/2026', '310', '1850', '45', '200', 'Y', '140', '9.55'],
  ), map({ unit_price: null }))
  assert.equal(report.backorder_value.value, null)
  assert.match(report.backorder_value.reason ?? '', /unit_price/)
})
