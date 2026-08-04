import { WHOLESALE_METRICS, type OpsBriefMetric, type OpsBriefInput } from '@/lib/ops-brief-schema'
import type { MappingEntry } from '@/lib/ops-brief-mapping'

export interface MetricResult {
  value: number | null
  reason?: string
}

export type MetricsReport = Record<OpsBriefMetric, MetricResult>

/**
 * Is this line backordered?
 *
 * The schema promises "a flag or status text", and real exports use both. The
 * original check was `/back/i`, which only ever matched status text — a `B/O?`
 * column of Y/N, one of the most common shapes in a distribution export, matched
 * nothing and the metric reported "insufficient data" about a file that had the
 * data sitting right there.
 *
 * Explicit negatives are matched as negatives rather than left to fall through,
 * so a future pattern change can't silently turn "N" into a backordered line.
 */
function isBackordered(raw: string): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return false
  if (['n', 'no', 'false', '0', '-', 'none', 'na', 'n/a'].includes(v)) return false
  if (['y', 'yes', 'true', '1', 'x'].includes(v)) return true
  return /back|b\/o/i.test(v)
}

function findColumnIndex(headers: string[], columnName: string | null): number {
  if (!columnName) return -1
  const target = columnName.trim().toLowerCase()
  return headers.findIndex(h => h.trim().toLowerCase() === target)
}

function columnValues(headers: string[], dataRows: string[][], columnName: string | null): string[] {
  const idx = findColumnIndex(headers, columnName)
  if (idx === -1) return []
  return dataRows.map(row => (row[idx] ?? '').trim())
}

function toNumber(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[$,%]/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function toDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Computes each of the 5 wholesale output metrics from the confirmed mapping.
 * A metric with no mapped column for one of its required inputs reports why it
 * couldn't be computed rather than throwing — a real, useful test result, not a bug.
 */
export function computeMetrics(
  headers: string[],
  dataRows: string[][],
  mapping: Record<OpsBriefInput, MappingEntry>
): MetricsReport {
  const report = {} as MetricsReport

  for (const metricDef of WHOLESALE_METRICS) {
    const missing = metricDef.requires.filter(key => !mapping[key]?.column)
    if (missing.length > 0) {
      report[metricDef.key] = {
        value: null,
        reason: `No mapped column for: ${missing.join(', ')}.`,
      }
      continue
    }
    report[metricDef.key] = computeOne(metricDef.key, headers, dataRows, mapping)
  }

  return report
}

function computeOne(
  metric: OpsBriefMetric,
  headers: string[],
  dataRows: string[][],
  mapping: Record<OpsBriefInput, MappingEntry>
): MetricResult {
  switch (metric) {
    case 'order_fill_rate': {
      const values = columnValues(headers, dataRows, mapping.order_status.column).filter(v => v !== '')
      if (values.length === 0) return { value: null, reason: 'Mapped status column has no data.' }
      const shipped = values.filter(v => /^ship/i.test(v)).length
      return { value: round1((shipped / values.length) * 100) }
    }

    case 'inventory_turns_annualized': {
      const sold = columnValues(headers, dataRows, mapping.units_sold_or_cogs.column).map(toNumber).filter((n): n is number => n !== null)
      const inv = columnValues(headers, dataRows, mapping.avg_inventory_on_hand.column).map(toNumber).filter((n): n is number => n !== null)
      if (sold.length === 0 || inv.length === 0) {
        return { value: null, reason: 'Mapped columns had no usable numeric data.' }
      }
      const totalSold = sold.reduce((a, b) => a + b, 0)
      const avgInventory = inv.reduce((a, b) => a + b, 0) / inv.length
      if (avgInventory === 0) return { value: null, reason: 'Average inventory computed as zero — cannot divide.' }
      return { value: round1(totalSold / avgInventory) }
    }

    case 'stockout_risk_sku_count': {
      // Counts LINES at or below their reorder point, not distinct SKUs — the
      // input schema carries no SKU identifier, so deduplication is impossible.
      // It was previously labelled "SKU Count", which over-reported whenever one
      // SKU appeared on several orders: a 20-line file with 5 at-risk SKUs read
      // as 12. The key is left alone to avoid a migration; the label is honest.
      // `<=` is deliberate: hitting the reorder point is the trigger to reorder.
      const stock = columnValues(headers, dataRows, mapping.current_stock.column)
      const reorder = columnValues(headers, dataRows, mapping.reorder_point.column)
      let count = 0
      let evaluated = 0
      for (let i = 0; i < Math.min(stock.length, reorder.length); i++) {
        const s = toNumber(stock[i])
        const r = toNumber(reorder[i])
        if (s === null || r === null) continue
        evaluated++
        if (s <= r) count++
      }
      if (evaluated === 0) return { value: null, reason: 'Could not pair numeric stock/reorder values on any row.' }
      return { value: count }
    }

    case 'avg_order_cycle_time_days': {
      const orderDates = columnValues(headers, dataRows, mapping.order_date.column)
      const shipDates = columnValues(headers, dataRows, mapping.ship_date.column)
      const diffs: number[] = []
      for (let i = 0; i < Math.min(orderDates.length, shipDates.length); i++) {
        const od = toDate(orderDates[i])
        const sd = toDate(shipDates[i])
        if (!od || !sd) continue
        const days = (sd.getTime() - od.getTime()) / (1000 * 60 * 60 * 24)
        if (days >= 0) diffs.push(days)
      }
      if (diffs.length === 0) return { value: null, reason: 'Could not parse a valid order-date/ship-date pair on any row.' }
      return { value: round1(diffs.reduce((a, b) => a + b, 0) / diffs.length) }
    }

    case 'backorder_value': {
      const status = columnValues(headers, dataRows, mapping.backorder_status.column)
      const qty = columnValues(headers, dataRows, mapping.backorder_quantity.column)
      const price = columnValues(headers, dataRows, mapping.unit_price.column)
      let total = 0
      let matched = 0
      const len = Math.min(status.length, qty.length, price.length)
      for (let i = 0; i < len; i++) {
        if (!isBackordered(status[i])) continue
        const q = toNumber(qty[i])
        const p = toNumber(price[i])
        if (q === null || p === null) continue
        total += q * p
        matched++
      }
      if (matched === 0) return { value: null, reason: 'No rows matched as backordered with a valid quantity and price.' }
      return { value: round1(total) }
    }

    default:
      return { value: null, reason: 'Unknown metric.' }
  }
}
