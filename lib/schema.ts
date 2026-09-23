import { z } from "zod";

/**
 * Single source of truth for what every model must return.
 * Fields are nullable (not optional) so structured-output modes of all
 * providers can represent "not present on the receipt" explicitly.
 */
export const LineItemSchema = z.object({
  name: z.string().describe("Item description as printed on the receipt"),
  qty: z.number().nullable().describe("Quantity; null if not printed"),
  unit_price: z.number().nullable().describe("Price per unit; null if not printed"),
  amount: z.number().nullable().describe("Line total as printed"),
});

export const ReceiptSchema = z.object({
  merchant: z.string().nullable().describe("Business / seller name"),
  date: z.string().nullable().describe("Transaction date in ISO format YYYY-MM-DD"),
  currency: z.string().nullable().describe("ISO 4217 code, e.g. TRY, USD, EUR"),
  subtotal: z.number().nullable().describe("Amount before tax; null if not printed"),
  tax: z.number().nullable().describe("Total tax (VAT/KDV) amount; null if not printed"),
  total: z.number().nullable().describe("Grand total paid"),
  line_items: z.array(LineItemSchema),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

export const SCALAR_FIELDS = ["merchant", "date", "currency", "subtotal", "tax", "total"] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];

export const ALL_FIELDS = [...SCALAR_FIELDS, "line_items"] as const;
export type ReceiptField = (typeof ALL_FIELDS)[number];

export type FieldKind = "text" | "date" | "currency" | "number";

export const FIELD_KINDS: Record<ScalarField, FieldKind> = {
  merchant: "text",
  date: "date",
  currency: "currency",
  subtotal: "number",
  tax: "number",
  total: "number",
};

export const LINE_ITEM_FIELDS = ["name", "qty", "unit_price", "amount"] as const;
export type LineItemField = (typeof LINE_ITEM_FIELDS)[number];

/** Schema containing only the requested fields — used for the blind arbiter call. */
export function partialReceiptSchema(fields: readonly ReceiptField[]) {
  const mask = Object.fromEntries(fields.map((f) => [f, true])) as Partial<Record<ReceiptField, true>>;
  return ReceiptSchema.pick(mask);
}
