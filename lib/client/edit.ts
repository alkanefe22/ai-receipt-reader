import { consensusToReceipt } from "@/lib/consensus/consensus";
import type { ConsensusResult, FieldResult, LineItemResult } from "@/lib/consensus/types";
import { validateReceipt } from "@/lib/consensus/validate";
import type { ExtractSuccess } from "@/lib/api-types";
import { LINE_ITEM_FIELDS, type LineItem, type LineItemField, type Receipt, type ScalarField } from "@/lib/schema";

/**
 * Pure, immutable edits of an extraction result. Every edit marks the field
 * as `edited` and re-runs the totals validation.
 */

function withConsensus(result: ExtractSuccess, consensus: ConsensusResult): ExtractSuccess {
  return { ...result, consensus, validation: validateReceipt(consensusToReceipt(consensus)) };
}

const edit = <T>(field: FieldResult<T>, value: T): FieldResult<T> => ({ ...field, value, edited: true });

export function editField<K extends ScalarField>(result: ExtractSuccess, field: K, value: Receipt[K]): ExtractSuccess {
  const c = result.consensus;
  return withConsensus(result, { ...c, fields: { ...c.fields, [field]: edit(c.fields[field], value) } });
}

export function editLineItem<K extends LineItemField>(
  result: ExtractSuccess,
  index: number,
  field: K,
  value: LineItem[K],
): ExtractSuccess {
  const c = result.consensus;
  const items = c.line_items.items.map((item, i) =>
    i === index ? { ...item, [field]: edit(item[field] as FieldResult<LineItem[K]>, value) } : item,
  );
  return withConsensus(result, { ...c, line_items: { ...c.line_items, items } });
}

const blankField = <T>(value: T): FieldResult<T> => ({ value, status: "agreed", candidates: {}, majority: [], edited: true });

export function addLineItem(result: ExtractSuccess): ExtractSuccess {
  const c = result.consensus;
  const blank = {
    ...(Object.fromEntries(LINE_ITEM_FIELDS.map((f) => [f, blankField(f === "name" ? "" : null)])) as Omit<LineItemResult, "seenBy">),
    seenBy: [],
  } as LineItemResult;
  return withConsensus(result, { ...c, line_items: { ...c.line_items, items: [...c.line_items.items, blank] } });
}

export function removeLineItem(result: ExtractSuccess, index: number): ExtractSuccess {
  const c = result.consensus;
  const items = c.line_items.items.filter((_, i) => i !== index);
  return withConsensus(result, { ...c, line_items: { ...c.line_items, items } });
}
