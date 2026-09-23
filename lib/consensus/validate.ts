import type { Receipt } from "@/lib/schema";

/**
 * Arithmetic sanity checks on the final values. Pure and isomorphic so the UI
 * can re-run it live while the user edits.
 *
 * Turkish receipts usually print line prices VAT-inclusive (KDV dahil), so
 * Σitems ≈ total is accepted as well as the tax-exclusive Σitems + tax ≈ total.
 */

export type TaxMode = "inclusive" | "exclusive" | "unknown";

export type ValidationWarning =
  | { code: "total_missing" }
  | { code: "items_total_mismatch"; itemsSum: number; tax: number | null; total: number }
  | { code: "subtotal_mismatch"; subtotal: number; tax: number; total: number }
  | { code: "line_math_mismatch"; index: number; qty: number; unitPrice: number; amount: number }
  | { code: "line_amount_missing"; index: number };

export type ValidationResult = {
  ok: boolean;
  taxMode: TaxMode;
  itemsSum: number | null;
  warnings: ValidationWarning[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sums accumulate per-line rounding, so allow a cent per line (min 2 cents) or 0.1 %. */
function sumsMatch(x: number, y: number, lines: number): boolean {
  const tolerance = Math.max(0.02, 0.01 * lines, 0.001 * Math.max(Math.abs(x), Math.abs(y)));
  return Math.abs(x - y) <= tolerance + 1e-9;
}

function lineAmount(item: Receipt["line_items"][number]): number | null {
  if (item.amount != null) return item.amount;
  if (item.qty != null && item.unit_price != null) return item.qty * item.unit_price;
  return null;
}

export function validateReceipt(r: Receipt): ValidationResult {
  const warnings: ValidationWarning[] = [];
  let taxMode: TaxMode = "unknown";

  r.line_items.forEach((item, index) => {
    if (item.amount == null && (item.qty == null || item.unit_price == null)) {
      warnings.push({ code: "line_amount_missing", index });
    }
    if (item.qty != null && item.unit_price != null && item.amount != null) {
      if (!sumsMatch(item.qty * item.unit_price, item.amount, 1)) {
        warnings.push({ code: "line_math_mismatch", index, qty: item.qty, unitPrice: item.unit_price, amount: item.amount });
      }
    }
  });

  const amounts = r.line_items.map(lineAmount);
  const itemsSum = amounts.length > 0 && amounts.every((x) => x != null)
    ? round2(amounts.reduce<number>((s, x) => s + x!, 0))
    : null;

  if (r.total == null) {
    warnings.push({ code: "total_missing" });
  } else {
    if (itemsSum != null) {
      const lines = r.line_items.length;
      if (r.tax != null && sumsMatch(itemsSum + r.tax, r.total, lines)) taxMode = "exclusive";
      else if (sumsMatch(itemsSum, r.total, lines)) taxMode = "inclusive";
      else warnings.push({ code: "items_total_mismatch", itemsSum, tax: r.tax, total: r.total });
    }

    if (r.subtotal != null && r.tax != null) {
      const exclusive = sumsMatch(r.subtotal + r.tax, r.total, 1);
      const inclusive = sumsMatch(r.subtotal, r.total, 1);
      if (!exclusive && !inclusive) {
        warnings.push({ code: "subtotal_mismatch", subtotal: r.subtotal, tax: r.tax, total: r.total });
      } else if (taxMode === "unknown") {
        taxMode = exclusive ? "exclusive" : "inclusive";
      }
    }
  }

  return { ok: warnings.length === 0, taxMode, itemsSum, warnings };
}
