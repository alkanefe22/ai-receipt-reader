import { describe, expect, it } from "vitest";
import { validateReceipt } from "@/lib/consensus/validate";
import { item, receipt } from "./fixtures";

describe("validateReceipt", () => {
  it("accepts tax-exclusive receipts (items + tax = total)", () => {
    const v = validateReceipt(receipt());
    expect(v).toMatchObject({ ok: true, taxMode: "exclusive", itemsSum: 150 });
  });

  it("accepts tax-inclusive receipts (items = total, KDV dahil)", () => {
    const v = validateReceipt(receipt({ subtotal: null, tax: 25, total: 150 }));
    expect(v).toMatchObject({ ok: true, taxMode: "inclusive" });
  });

  it("warns when items do not add up", () => {
    const v = validateReceipt(receipt({ total: 200, subtotal: null }));
    expect(v.ok).toBe(false);
    expect(v.warnings).toContainEqual({ code: "items_total_mismatch", itemsSum: 150, tax: 15, total: 200 });
  });

  it("checks qty x unit price per line", () => {
    const v = validateReceipt(receipt({ line_items: [item("Ekmek", 2, 10, 25)], subtotal: null, tax: null, total: 25 }));
    expect(v.warnings).toEqual([{ code: "line_math_mismatch", index: 0, qty: 2, unitPrice: 10, amount: 25 }]);
  });

  it("derives a missing amount from qty x unit price", () => {
    const v = validateReceipt(receipt({ line_items: [item("Ekmek", 2, 10, null)], subtotal: null, tax: null, total: 20 }));
    expect(v).toMatchObject({ ok: true, itemsSum: 20 });
  });

  it("handles negative discount lines", () => {
    const v = validateReceipt(
      receipt({ line_items: [...receipt().line_items, item("İndirim", null, null, -10)], subtotal: null, tax: 15, total: 155 }),
    );
    expect(v.ok).toBe(true);
  });

  it("tolerates per-line rounding", () => {
    const lines = Array.from({ length: 3 }, () => item("Çay", 1, 3.33, 3.33));
    const v = validateReceipt(receipt({ line_items: lines, subtotal: null, tax: null, total: 10 }));
    expect(v.ok).toBe(true);
  });

  it("reports a missing total", () => {
    expect(validateReceipt(receipt({ total: null })).warnings).toContainEqual({ code: "total_missing" });
  });

  it("checks subtotal + tax against total", () => {
    const v = validateReceipt(receipt({ line_items: [], subtotal: 100, tax: 18, total: 130 }));
    expect(v.warnings).toContainEqual({ code: "subtotal_mismatch", subtotal: 100, tax: 18, total: 130 });
  });
});
