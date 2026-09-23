import { LINE_ITEM_FIELDS, SCALAR_FIELDS, type ReceiptField } from "@/lib/schema";
import { STATUS_RANK, type ConsensusResult, type FieldResult, type FieldStatus, type LineItemResult } from "@/lib/consensus/types";

/** What the UI and exports show: a user correction supersedes the machine status. */
export type DisplayStatus = FieldStatus | "edited";

export const displayStatus = (f: Pick<FieldResult<unknown>, "status" | "edited">): DisplayStatus =>
  f.edited ? "edited" : f.status;

/** Resolved = no machine uncertainty left (edited counts as resolved). */
const effective = (f: FieldResult<unknown>): FieldStatus => (f.edited ? "agreed" : f.status);

export function lineStatus(item: LineItemResult): DisplayStatus {
  const fields = LINE_ITEM_FIELDS.map((k) => item[k]);
  if (fields.some((f) => !f.edited && f.status === "needs_review")) return "needs_review";
  if (fields.some((f) => f.edited)) return "edited";
  return fields.some((f) => f.status === "arbitrated") ? "arbitrated" : "agreed";
}

/** Worst unresolved status across the whole document. */
export function documentStatus(c: ConsensusResult): FieldStatus {
  const all: FieldResult<unknown>[] = [
    ...SCALAR_FIELDS.map((f) => c.fields[f]),
    ...c.line_items.items.flatMap((i) => LINE_ITEM_FIELDS.map((f) => i[f])),
  ];
  let worst: FieldStatus = c.line_items.discarded.length ? "arbitrated" : "agreed";
  for (const f of all) if (STATUS_RANK[effective(f)] > STATUS_RANK[worst]) worst = effective(f);
  return worst;
}

/** Field names (and "line_items") still awaiting a human decision. */
export function fieldsNeedingReview(c: ConsensusResult): ReceiptField[] {
  const out: ReceiptField[] = SCALAR_FIELDS.filter((f) => !c.fields[f].edited && c.fields[f].status === "needs_review");
  if (c.line_items.items.some((i) => lineStatus(i) === "needs_review")) out.push("line_items");
  return out;
}

export function countNeedingReview(c: ConsensusResult): number {
  return (
    SCALAR_FIELDS.filter((f) => !c.fields[f].edited && c.fields[f].status === "needs_review").length +
    c.line_items.items.reduce(
      (n, i) => n + LINE_ITEM_FIELDS.filter((f) => !i[f].edited && i[f].status === "needs_review").length,
      0,
    )
  );
}
