import type { LineItem, Receipt } from "@/lib/schema";

export const item = (name: string, qty: number | null, unit_price: number | null, amount: number | null): LineItem => ({
  name,
  qty,
  unit_price,
  amount,
});

export function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    merchant: "Kuzey Market A.Ş.",
    date: "2026-03-07",
    currency: "TRY",
    subtotal: 150,
    tax: 15,
    total: 165,
    line_items: [item("Ekmek", 2, 10, 20), item("Beyaz Peynir", 1, 100, 100), item("Ayran", 3, 10, 30)],
    ...overrides,
  };
}
