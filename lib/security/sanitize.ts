/**
 * Output-encoding helpers. Each neutralizes a specific injection sink where
 * attacker-controlled data (a caller's name, a transcript, a search term) flows
 * into a context that would otherwise interpret it as code/markup/formula.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape a value for safe interpolation into an HTML document/email body.
 * Prevents stored/reflected HTML & script injection when user-supplied fields
 * (business name, caller name, email) are dropped into template-literal HTML.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c])
}

/**
 * Encode a single CSV field.
 *  1. Neutralizes spreadsheet formula injection: a cell beginning with = + - @
 *     or a control char is executed as a formula by Excel/Google Sheets when the
 *     export is opened. Prefixing an apostrophe forces literal text.
 *  2. Quotes the field (and doubles internal quotes) if it contains a comma,
 *     quote, or newline, so structure can't be broken out of.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

/**
 * Escape a string so it can be embedded literally inside a RegExp, defeating
 * regex injection / ReDoS via attacker-controlled search terms.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
