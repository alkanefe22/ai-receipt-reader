import { FIELD_KINDS, LINE_ITEM_FIELDS, SCALAR_FIELDS, type Receipt, type ReceiptField } from "@/lib/schema";
import { scalarFieldsEqual, voteField } from "./compare";
import { lineItemsDisputed, resolveLineItems } from "./lineItems";
import {
  worstStatus,
  type Candidates,
  type ConsensusFields,
  type ConsensusResult,
  type FieldResult,
  type LineItemResult,
  type Reader,
} from "./types";

/** Fields on which the two extractors disagree — exactly what the arbiter will be asked to read. */
export function findDisputes(a: Receipt, b: Receipt): ReceiptField[] {
  const disputed: ReceiptField[] = SCALAR_FIELDS.filter((f) => !scalarFieldsEqual(f, a, b));
  if (lineItemsDisputed(a.line_items, b.line_items)) disputed.push("line_items");
  return disputed;
}

/**
 * Pure resolution step. `arbiter` holds the blind reading of the disputed
 * fields only; pass `undefined` when no arbitration happened or it failed.
 */
export function resolveConsensus(
  a: Receipt,
  b: Receipt,
  arbiter?: Partial<Receipt>,
  meta: { disputed?: ReceiptField[]; arbiterError?: string } = {},
): ConsensusResult {
  const disputed = meta.disputed ?? findDisputes(a, b);
  const arbiterRead = (f: ReceiptField) => arbiter !== undefined && disputed.includes(f) && f in arbiter;

  const fields = Object.fromEntries(
    SCALAR_FIELDS.map((f) => [
      f,
      voteField(FIELD_KINDS[f], {
        a: a[f],
        b: b[f],
        ...(arbiterRead(f) ? { arbiter: arbiter![f] ?? null } : {}),
      }),
    ]),
  ) as ConsensusFields;

  const line_items = resolveLineItems(
    a.line_items,
    b.line_items,
    arbiterRead("line_items") ? (arbiter!.line_items ?? []) : undefined,
  );

  return {
    fields,
    line_items,
    disputed,
    arbiterUsed: arbiter !== undefined && disputed.length > 0,
    ...(meta.arbiterError ? { arbiterError: meta.arbiterError } : {}),
  };
}

export type ArbitrateFn = (fields: ReceiptField[]) => Promise<Partial<Receipt>>;

/**
 * Orchestrates: compare A/B → blind arbiter on disputed fields only → 2/3 vote.
 * An arbiter failure degrades gracefully: disputed fields become needs_review.
 */
export async function runConsensus(a: Receipt, b: Receipt, arbitrate: ArbitrateFn): Promise<ConsensusResult> {
  const disputed = findDisputes(a, b);
  if (disputed.length === 0) return resolveConsensus(a, b, undefined, { disputed });

  try {
    const arbiter = await arbitrate(disputed);
    return resolveConsensus(a, b, arbiter, { disputed });
  } catch (err) {
    const arbiterError = err instanceof Error ? err.message : String(err);
    return resolveConsensus(a, b, undefined, { disputed, arbiterError });
  }
}

/**
 * Re-labels a result produced with the arbiter model standing in for a failed
 * extractor: its readings are attributed to "arbiter" (not to the failed
 * reader), and "agreed" becomes "fallback_agreed" — two readers, no third vote.
 */
export function applyFallback(result: ConsensusResult, failedReader: "a" | "b"): ConsensusResult {
  const rename = (r: Reader): Reader => (r === failedReader ? "arbiter" : r);
  const relabel = (f: FieldResult<unknown>): FieldResult<unknown> => ({
    ...f,
    status: f.status === "agreed" ? "fallback_agreed" : f.status,
    candidates: Object.fromEntries(Object.entries(f.candidates).map(([r, v]) => [rename(r as Reader), v])) as Candidates<unknown>,
    majority: f.majority.map(rename),
  });

  const fields = Object.fromEntries(
    SCALAR_FIELDS.map((f) => [f, relabel(result.fields[f] as FieldResult<unknown>)]),
  ) as unknown as ConsensusFields;
  const items = result.line_items.items.map((item) => ({
    ...(Object.fromEntries(
      LINE_ITEM_FIELDS.map((f) => [f, relabel(item[f] as FieldResult<unknown>)]),
    ) as unknown as Omit<LineItemResult, "seenBy">),
    seenBy: item.seenBy.map(rename),
  }));
  return {
    ...result,
    fields,
    line_items: {
      status: worstStatus(items.flatMap((i) => LINE_ITEM_FIELDS.map((f) => i[f].status))),
      items,
      discarded: result.line_items.discarded.map((d) => ({ ...d, reader: rename(d.reader) })),
    },
    // Nothing was sent to a blind arbiter in this mode.
    disputed: [],
    arbiterUsed: false,
    fallback: { failedReader },
  };
}

/** Flattens a consensus result back into a plain receipt (current chosen values). */
export function consensusToReceipt(result: ConsensusResult): Receipt {
  const scalars = Object.fromEntries(SCALAR_FIELDS.map((f) => [f, result.fields[f].value]));
  return {
    ...(scalars as Omit<Receipt, "line_items">),
    line_items: result.line_items.items.map(
      (item) => Object.fromEntries(LINE_ITEM_FIELDS.map((f) => [f, item[f].value])) as Receipt["line_items"][number],
    ),
  };
}
