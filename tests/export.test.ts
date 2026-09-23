import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { resolveConsensus } from "@/lib/consensus/consensus";
import { validateReceipt } from "@/lib/consensus/validate";
import { toCsv } from "@/lib/export/csv";
import { lineItemsTable, receiptsTable, type ExportDoc } from "@/lib/export/rows";
import { STATUS_FILL, toXlsx } from "@/lib/export/xlsx";
import { en } from "@/lib/i18n/en";
import { item, receipt } from "./consensus/fixtures";

const labels = { t: en, warning: (w: { code: string }) => w.code };

function doc(): ExportDoc {
  const a = receipt({ merchant: "=HYPERLINK(\"x\")" });
  const b = receipt({ merchant: "=HYPERLINK(\"x\")", total: 156 });
  const consensus = resolveConsensus(a, b, { total: 999 });
  return { fileName: "fiş, 1.png", consensus, validation: validateReceipt(receipt()) };
}

describe("receiptsTable", () => {
  it("carries field statuses and review hints", () => {
    const table = receiptsTable([doc()], labels);
    const row = table.rows[0];
    const totalCell = row[1 + 5];
    expect(totalCell).toMatchObject({ status: "needs_review", kind: "money" });
    expect(row.at(-2)?.value).toBe("Total");
    expect(row.at(-3)).toMatchObject({ value: "Needs review", status: "needs_review" });
  });
});

describe("toCsv", () => {
  it("quotes, prefixes a BOM and neutralises formulas", () => {
    const csv = toCsv(receiptsTable([doc()], labels));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"fiş, 1.png"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("writes one row per line item", () => {
    const d = doc();
    d.consensus = resolveConsensus(receipt({ line_items: [item("Çay", 2, 15, 30)] }), receipt({ line_items: [item("Çay", 2, 15, 30)] }));
    const csv = toCsv(lineItemsTable([d], labels));
    expect(csv.trim().split("\r\n")).toHaveLength(2);
    expect(csv).toContain("Çay,2,15,30,Agreed");
  });
});

describe("toXlsx", () => {
  it("colours cells by status and adds a legend sheet", async () => {
    const blob = await toXlsx(
      [{ name: "Receipts", table: receiptsTable([doc()], labels) }],
      { title: "Legend", rows: [["agreed", "Agreed", "…"]] },
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Receipts")!;
    const total = ws.getRow(2).getCell(7);
    expect(total.value).toBe(165);
    expect((total.fill as { fgColor: { argb: string } }).fgColor.argb).toBe(STATUS_FILL.needs_review);
    expect(ws.getRow(2).getCell(2).value).toBe(`'=HYPERLINK("x")`);
    expect(wb.getWorksheet("Legend")).toBeDefined();
  });
});
