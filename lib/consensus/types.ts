import type { LineItem, LineItemField, Receipt, ReceiptField, ScalarField } from "@/lib/schema";

/**
 * - agreed:          both extractors read the same value
 * - arbitrated:      they disagreed; the blind arbiter matched one of them (2/3)
 * - fallback_agreed: an extractor failed and the arbiter model read in its place;
 *                    the two remaining readings agree, but there was no third vote
 * - needs_review:    no majority — a human must decide
 */
export type FieldStatus = "agreed" | "arbitrated" | "fallback_agreed" | "needs_review";

export const STATUS_RANK: Record<FieldStatus, number> = { agreed: 0, arbitrated: 1, fallback_agreed: 2, needs_review: 3 };

export function worstStatus(statuses: Iterable<FieldStatus>): FieldStatus {
  let worst: FieldStatus = "agreed";
  for (const s of statuses) if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s;
  return worst;
}

export type Reader = "a" | "b" | "arbiter";

/** Raw per-reader values; `undefined` means that reader did not report this field. */
export type Candidates<T> = Partial<Record<Reader, T>>;

export type FieldResult<T> = {
  value: T;
  status: FieldStatus;
  candidates: Candidates<T>;
  /** Readers whose value formed the accepted majority. */
  majority: Reader[];
  /** Set once a user overrides the value in the UI. */
  edited?: boolean;
};

export type LineItemResult = { [K in LineItemField]: FieldResult<LineItem[K]> } & {
  /** Which readers saw this line at all. */
  seenBy: Reader[];
};

export type LineItemsResult = {
  status: FieldStatus;
  items: LineItemResult[];
  /** Lines only one reader saw and the 2/3 majority rejected. */
  discarded: { reader: Reader; item: LineItem }[];
};

export type ConsensusFields = { [K in ScalarField]: FieldResult<Receipt[K]> };

export type ConsensusResult = {
  fields: ConsensusFields;
  line_items: LineItemsResult;
  /** Fields that were sent to the arbiter. */
  disputed: ReceiptField[];
  arbiterUsed: boolean;
  arbiterError?: string;
  /** Set when an extractor failed and the arbiter model substituted for it (no 2/3 vote possible). */
  fallback?: { failedReader: "a" | "b" };
};
