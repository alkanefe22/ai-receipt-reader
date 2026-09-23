import { FIELD_KINDS, LINE_ITEM_FIELDS, SCALAR_FIELDS, type Receipt, type ReceiptField } from "@/lib/schema";
import { scalarFieldsEqual, voteField } from "./compare";
import { lineItemsDisputed, resolveLineItems } from "./lineItems";
import type { ConsensusFields, ConsensusResult } from "./types";

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
