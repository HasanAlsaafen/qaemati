/**
 * One CSV field, safe to open in a spreadsheet. A cell that starts with = + - or @
 * is read as a formula by Excel and Sheets, so a dish or table named
 * "=HYPERLINK(...)" could run something on the owner's machine. A leading
 * apostrophe makes it plain text. Quotes, commas and line breaks are quoted.
 */
export function csvField(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRows(rows: unknown[][]): string {
  // The byte order mark makes Excel read Arabic as UTF-8 instead of garbling it.
  return `﻿${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}
