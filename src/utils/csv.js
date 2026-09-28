// Minimal RFC 4180 CSV builder + browser download, with spreadsheet-formula
// injection protection (cells starting with = + - @ are prefixed with ').

const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * columns: [{ header: 'Full Name', value: (row) => row.fullName }, ...]
 */
export function buildCsv(rows, columns) {
  const lines = [
    columns.map((col) => escapeCell(col.header)).join(','),
    ...rows.map((row) => columns.map((col) => escapeCell(col.value(row))).join(','))
  ];
  return lines.join('\r\n');
}

export function downloadCsv(filename, csv) {
  // UTF-8 BOM so Excel shows names with accents / Swahili characters correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
