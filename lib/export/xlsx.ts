import type { DisplayStatus } from "@/lib/status";
import type { Cell, Table } from "./rows";

/** Cell fills matching the UI's status colours. */
export const STATUS_FILL: Record<DisplayStatus, string> = {
  agreed: "FFD1FAE5",
  arbitrated: "FFDBEAFE",
  fallback_agreed: "FFCCFBF1",
  needs_review: "FFFEF3C7",
  edited: "FFEDE9FE",
};

type Sheet = { name: string; table: Table };

const SAFE_TEXT = /^[=+\-@\t\r]/;

function cellValue(c: Cell): string | number | null {
  // Model-read text must never become a formula.
  if (typeof c.value === "string" && SAFE_TEXT.test(c.value)) return `'${c.value}`;
  return c.value;
}

/** Builds the workbook in the browser; exceljs is loaded on demand to keep the page bundle small. */
export async function toXlsx(sheets: Sheet[], legend: { title: string; rows: [DisplayStatus, string, string][] }): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI Receipt & Invoice Reader";
  wb.created = new Date();

  for (const { name, table } of sheets) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    const header = ws.addRow(table.header);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    });

    for (const row of table.rows) {
      const added = ws.addRow(row.map(cellValue));
      row.forEach((c, i) => {
        const cell = added.getCell(i + 1);
        if (c.kind === "money") cell.numFmt = "#,##0.00";
        if (c.kind === "number") cell.numFmt = "#,##0.###";
        if (c.status) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[c.status] } };
      });
    }

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.header.length } };
    ws.columns.forEach((col, i) => {
      const longest = Math.max(
        table.header[i]?.length ?? 0,
        ...table.rows.map((r) => String(r[i]?.value ?? "").length),
      );
      col.width = Math.min(60, Math.max(10, longest + 2));
    });
  }

  const lg = wb.addWorksheet(legend.title);
  for (const [status, label, description] of legend.rows) {
    const row = lg.addRow([label, description]);
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[status] } };
  }
  lg.getColumn(1).width = 20;
  lg.getColumn(2).width = 70;

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
