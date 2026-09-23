import type { Table } from "./rows";

/**
 * RFC 4180 CSV. Numbers use a dot decimal separator so any tool can parse them;
 * the UTF-8 BOM makes Excel detect Turkish characters correctly.
 */
function escapeCell(value: string | number | null): string {
  if (value == null) return "";
  let s = String(value);
  // Neutralise spreadsheet formula injection from model-read text.
  if (/^[=+\-@\t\r]/.test(s) && typeof value === "string") s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(table: Table): string {
  const lines = [table.header, ...table.rows.map((r) => r.map((c) => c.value))].map((row) => row.map(escapeCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
