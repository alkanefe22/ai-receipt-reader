import type { ReceiptField } from "@/lib/schema";

/**
 * Shared reading rules. Both extractors and the arbiter get the same rules so
 * their outputs are comparable; only the requested field set differs.
 */
const READING_RULES = `
You read receipts and invoices (Turkish or English) and return structured data.

Rules:
- Transcribe what is PRINTED. Never guess or invent values; use null when a value is not printed or unreadable.
- Do not compute values that are not printed, except currency which may be inferred from symbols (₺, TL, $, €, £).
- Numbers: return plain JSON numbers with a dot as the decimal separator. Turkish "1.234,56" → 1234.56.
- Dates: ISO format YYYY-MM-DD. Turkish and European receipts are day-first (07.03.2026 → 2026-03-07).
  US receipts (USD/$ prices, a US address or state) are month-first: 08/02/2026 → 2026-08-02.
  Decide the order from the document's country before converting an ambiguous date.
- Currency: ISO 4217 code (TL/₺ → TRY).
- merchant: the business name as printed at the top, without address.
- tax: the total VAT/KDV amount ("TOPKDV", "KDV", "VAT", "Tax"). If several rates are listed, sum them.
- subtotal: the pre-tax amount ONLY if printed as such ("Ara Toplam", "Subtotal"); otherwise null.
- total: the grand total paid ("TOPLAM", "GENEL TOPLAM", "Total", "Amount due").
- line_items: one entry per purchased line, in printed order.
  - name: item text as printed (keep original language and spelling).
  - qty / unit_price: only if printed ("2 X 10,00" → qty 2, unit_price 10). Otherwise null.
  - Turkish receipt layout: a quantity line such as "2 X 85,00" is printed on its own line directly ABOVE
    the item name it belongs to; the item line then shows the VAT rate and line total ("%10 *170,00").
    Pair each quantity line with the item BELOW it, never with the item above. A quantity line is not an item,
    and the "%10" VAT rate is not an amount.
  - Check each line: qty × unit_price must equal amount. If it does not, re-read that line.
  - amount: the line total as printed.
  - Discounts ("İNDİRİM", "Discount") are separate lines with a NEGATIVE amount.
  - Do not include tax, subtotal, total, payment, change or loyalty lines as items.
`.trim();

export const EXTRACTION_INSTRUCTIONS = READING_RULES;

export const EXTRACTION_PROMPT = "Extract all fields from this receipt/invoice.";

export const ARBITER_INSTRUCTIONS = `${READING_RULES}

You are an independent reader. Read ONLY the fields you are asked for, carefully and directly from the document.`;

const FIELD_HINTS: Record<ReceiptField, string> = {
  merchant: "merchant (business name)",
  date: "date (transaction date)",
  currency: "currency",
  subtotal: "subtotal (pre-tax amount, null if not printed)",
  tax: "tax (total VAT/KDV)",
  total: "total (grand total)",
  line_items: "line_items (every purchased line, including discounts)",
};

/** Blind by construction: it only names fields, never the values other models read. */
export function arbiterPrompt(fields: readonly ReceiptField[]): string {
  return `Read these fields from the document:\n${fields.map((f) => `- ${FIELD_HINTS[f]}`).join("\n")}`;
}
