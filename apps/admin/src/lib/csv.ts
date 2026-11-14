/**
 * CSV for spreadsheet software set to French: UTF-8 with a byte order mark, semicolons
 * between cells, CRLF between rows.
 */

export const CSV_BOM = '\uFEFF'
const SEPARATOR = ';'
const EOL = '\r\n'

/** Characters that make a spreadsheet read a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = value.replace(/\r\n?/g, '\n')
  // Customer-typed text must never run as a formula when the file is opened.
  if (FORMULA_START.test(text)) text = `'${text}`
  if (/[";\n]/.test(text) || /^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(SEPARATOR) + EOL
}
