import { FIELD_KINDS, type FieldKind, type LineItem, type LineItemField, type Receipt, type ScalarField } from "@/lib/schema";
import {
  currenciesEqual,
  datesEqual,
  normalizeCurrency,
  normalizeDate,
  numbersEqual,
  textValuesEqual,
} from "./normalize";
import type { FieldResult, Reader } from "./types";

type Scalar = string | number | null;

export function valuesEqual(kind: FieldKind, a: Scalar | undefined, b: Scalar | undefined): boolean {
  switch (kind) {
    case "number":
      return numbersEqual(a as number | null, b as number | null);
    case "date":
      return datesEqual(a as string | null, b as string | null);
    case "currency":
      return currenciesEqual(a as string | null, b as string | null);
    case "text":
      return textValuesEqual(a as string | null, b as string | null);
  }
}

/** Presents agreed values in one canonical form (ISO date, ISO currency). */
export function canonicalize<T extends Scalar>(kind: FieldKind, value: T): T {
  if (typeof value !== "string") return value;
  if (kind === "date") return (normalizeDate(value) ?? value) as T;
  if (kind === "currency") return (normalizeCurrency(value) ?? value) as T;
  return value;
}

export const LINE_ITEM_KINDS: Record<LineItemField, FieldKind> = {
  name: "text",
  qty: "number",
  unit_price: "number",
  amount: "number",
};

export function scalarFieldsEqual(field: ScalarField, a: Receipt, b: Receipt): boolean {
  return valuesEqual(FIELD_KINDS[field], a[field], b[field]);
}

export function lineItemFieldEqual(field: LineItemField, a: LineItem, b: LineItem): boolean {
  return valuesEqual(LINE_ITEM_KINDS[field], a[field], b[field]);
}

/**
 * 2-of-3 vote over whichever readers supplied a value.
 * A and B agreeing always wins as "agreed"; otherwise any pair that agrees
 * (necessarily involving the arbiter) wins as "arbitrated".
 */
export function voteField<T extends Scalar>(kind: FieldKind, candidates: Partial<Record<Reader, T>>): FieldResult<T> {
  const { a, b, arbiter } = candidates;
  const has = (r: Reader) => candidates[r] !== undefined;

  if (has("a") && has("b") && valuesEqual(kind, a, b)) {
    return { value: canonicalize(kind, a as T), status: "agreed", candidates, majority: ["a", "b"] };
  }
  if (has("arbiter")) {
    for (const side of ["a", "b"] as const) {
      if (has(side) && valuesEqual(kind, candidates[side], arbiter)) {
        return {
          value: canonicalize(kind, candidates[side] as T),
          status: "arbitrated",
          candidates,
          majority: [side, "arbiter"],
        };
      }
    }
  }
  // No majority: prefill with the first available reading so the user edits rather than retypes.
  const fallback = (has("a") ? a : has("b") ? b : arbiter) ?? null;
  return { value: fallback as T, status: "needs_review", candidates, majority: [] };
}
