import * as XLSX from 'xlsx'

/**
 * Parses a CSV or XLSX file buffer into raw rows (no header assumed yet — that's
 * Claude's job in lib/ops-brief-mapping.ts, since messy real-world exports can have
 * title rows, spacer rows, etc. above the real header).
 *
 * Strips fully-empty rows (a common "visual spacer" row in messy exports) and
 * normalizes every cell to a trimmed string.
 */
export function parseRawRows(fileBuffer: ArrayBuffer): string[][] {
  const data = new Uint8Array(fileBuffer)
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  return rows
    .map(row => row.map(cell => (cell === null || cell === undefined ? '' : String(cell).trim())))
    .filter(row => row.some(cell => cell !== ''))
}
