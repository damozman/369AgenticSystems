// Wholesale v1 target schema for the ops-brief parsing test harness.
// See docs/next-opportunities.md and the pasted OPS-BRIEF-PARSING-BLUEPRINT for the
// origin of these five output metrics.
//
// Most of the 5 metrics genuinely need TWO raw values (e.g. order-date AND ship-date
// for cycle time; current-stock AND reorder-point for stockout risk) — mapping each
// output metric to a single column would make 4 of 5 structurally uncomputable even
// when the data exists. So Claude maps these 10 raw INPUT fields; the metrics
// computation in lib/ops-brief-metrics.ts combines them into the 5 OUTPUT metrics.

export type OpsBriefInput =
  | 'order_status'          // per-order status text, e.g. SHIPPED / PARTIAL / OPEN
  | 'order_date'            // date the order was placed
  | 'ship_date'              // date the order shipped / fulfilled
  | 'units_sold_or_cogs'     // numeric — sales volume or cost of goods sold
  | 'avg_inventory_on_hand' // numeric — inventory level
  | 'current_stock'         // numeric — per-SKU current stock level
  | 'reorder_point'         // numeric — per-SKU reorder threshold
  | 'backorder_status'      // per-line-item flag/status indicating backordered
  | 'backorder_quantity'    // numeric — quantity backordered
  | 'unit_price'            // numeric — price per unit

export interface OpsBriefInputDef {
  key: OpsBriefInput
  label: string
  description: string
}

export const WHOLESALE_INPUT_SCHEMA: OpsBriefInputDef[] = [
  { key: 'order_status', label: 'Order Status', description: 'Per-order status text, e.g. "SHIPPED", "PARTIAL", "OPEN".' },
  { key: 'order_date', label: 'Order Date', description: 'The date an order was placed.' },
  { key: 'ship_date', label: 'Ship Date', description: 'The date an order shipped or was fulfilled.' },
  { key: 'units_sold_or_cogs', label: 'Units Sold / COGS', description: 'A numeric sales volume or cost-of-goods-sold figure.' },
  { key: 'avg_inventory_on_hand', label: 'Avg. Inventory on Hand', description: 'A numeric inventory-on-hand figure.' },
  { key: 'current_stock', label: 'Current Stock', description: 'Numeric current stock level, per SKU/line.' },
  { key: 'reorder_point', label: 'Reorder Point', description: 'Numeric reorder threshold, per SKU/line.' },
  { key: 'backorder_status', label: 'Backorder Status', description: 'A flag or status text indicating a line item is backordered.' },
  { key: 'backorder_quantity', label: 'Backorder Quantity', description: 'Numeric quantity currently backordered.' },
  { key: 'unit_price', label: 'Unit Price', description: 'Numeric price per unit, for valuing backorder lines.' },
]

export type OpsBriefMetric =
  | 'order_fill_rate'
  | 'inventory_turns_annualized'
  | 'stockout_risk_sku_count'
  | 'avg_order_cycle_time_days'
  | 'backorder_value'

export interface OpsBriefMetricDef {
  key: OpsBriefMetric
  label: string
  unit: string
  requires: OpsBriefInput[]
}

export const WHOLESALE_METRICS: OpsBriefMetricDef[] = [
  { key: 'order_fill_rate', label: 'Order Fill Rate', unit: '%', requires: ['order_status'] },
  { key: 'inventory_turns_annualized', label: 'Inventory Turns (Annualized)', unit: 'ratio', requires: ['units_sold_or_cogs', 'avg_inventory_on_hand'] },
  { key: 'stockout_risk_sku_count', label: 'Stockout Risk (Lines At/Below Reorder Point)', unit: 'lines', requires: ['current_stock', 'reorder_point'] },
  { key: 'avg_order_cycle_time_days', label: 'Avg. Order Cycle Time', unit: 'days', requires: ['order_date', 'ship_date'] },
  { key: 'backorder_value', label: 'Backorder Value', unit: '$', requires: ['backorder_status', 'backorder_quantity', 'unit_price'] },
]
