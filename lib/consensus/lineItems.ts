import { LINE_ITEM_FIELDS, type LineItem } from "@/lib/schema";
import { LINE_ITEM_KINDS, lineItemFieldEqual, voteField } from "./compare";
import { numbersEqual, textSimilarity } from "./normalize";
import { worstStatus, type FieldStatus, type LineItemResult, type LineItemsResult, type Reader } from "./types";

/**
 * Line items cannot be compared index-by-index: models skip, merge or reorder
 * lines. We therefore cluster lines that refer to the same purchase, then vote
 * inside each cluster.
 */

type Cluster = { members: Partial<Record<Reader, LineItem>>; order: number };

/** Minimum score for two lines to be considered the same purchase. */
export const LINE_MATCH_THRESHOLD = 0.6;
const AMOUNT_BONUS = 0.15;

function pairScore(x: LineItem, y: LineItem): number {
  const amountMatch = x.amount != null && numbersEqual(x.amount, y.amount);
  return textSimilarity(x.name, y.name) + (amountMatch ? AMOUNT_BONUS : 0);
}

function clusterScore(cluster: Cluster, item: LineItem): number {
  return Math.max(...Object.values(cluster.members).map((m) => pairScore(m, item)));
}

/** Greedy best-first assignment of a reader's lines onto existing clusters. */
function assign(clusters: Cluster[], items: LineItem[], reader: Reader): Cluster[] {
  const candidates: { i: number; j: number; score: number }[] = [];
  items.forEach((item, i) =>
    clusters.forEach((cluster, j) => {
      const score = clusterScore(cluster, item);
      if (score >= LINE_MATCH_THRESHOLD) candidates.push({ i, j, score });
    }),
  );
  // Highest score first; on ties prefer lines at similar positions.
  candidates.sort((x, y) => y.score - x.score || Math.abs(x.i - clusters[x.j].order) - Math.abs(y.i - clusters[y.j].order));

  const usedItems = new Set<number>();
  const usedClusters = new Set<number>();
  for (const { i, j } of candidates) {
    if (usedItems.has(i) || usedClusters.has(j)) continue;
    clusters[j].members[reader] = items[i];
    usedItems.add(i);
    usedClusters.add(j);
  }

  const next = [...clusters];
  items.forEach((item, i) => {
    if (!usedItems.has(i)) next.push({ members: { [reader]: item }, order: i + 0.5 });
  });
  return next.sort((x, y) => x.order - y.order);
}

export function clusterLineItems(a: LineItem[], b: LineItem[], arbiter?: LineItem[]): Cluster[] {
  let clusters: Cluster[] = a.map((item, i) => ({ members: { a: item }, order: i }));
  clusters = assign(clusters, b, "b");
  if (arbiter) clusters = assign(clusters, arbiter, "arbiter");
  return clusters;
}

/** True when A and B disagree on the set of lines or on any field of a line. */
export function lineItemsDisputed(a: LineItem[], b: LineItem[]): boolean {
  return clusterLineItems(a, b).some(
    ({ members }) =>
      !members.a || !members.b || LINE_ITEM_FIELDS.some((f) => !lineItemFieldEqual(f, members.a!, members.b!)),
  );
}

export function resolveLineItems(a: LineItem[], b: LineItem[], arbiter?: LineItem[]): LineItemsResult {
  const items: LineItemResult[] = [];
  const discarded: LineItemsResult["discarded"] = [];

  for (const { members } of clusterLineItems(a, b, arbiter)) {
    const seenBy = (Object.keys(members) as Reader[]).filter((r) => members[r]);

    // With three readers, a line only one of them saw is outvoted 2:1.
    if (arbiter && seenBy.length < 2) {
      discarded.push({ reader: seenBy[0], item: members[seenBy[0]]! });
      continue;
    }

    const pick = <K extends keyof LineItem>(field: K) =>
      Object.fromEntries(seenBy.map((r) => [r, members[r]![field]])) as Partial<Record<Reader, LineItem[K]>>;

    const result = Object.fromEntries(
      LINE_ITEM_FIELDS.map((f) => [f, voteField(LINE_ITEM_KINDS[f], pick(f))]),
    ) as Omit<LineItemResult, "seenBy">;

    // A line seen by a single reader (arbiter unavailable) cannot be trusted.
    if (seenBy.length < 2) {
      for (const f of LINE_ITEM_FIELDS) result[f].status = "needs_review";
    }
    items.push({ ...result, seenBy });
  }

  const statuses: FieldStatus[] = items.flatMap((item) => LINE_ITEM_FIELDS.map((f) => item[f].status));
  if (discarded.length > 0) statuses.push("arbitrated");
  return { status: worstStatus(statuses), items, discarded };
}
