import type { ConsensusResult } from "@/lib/consensus/types";
import type { ValidationResult, ValidationWarning } from "@/lib/consensus/validate";
import type { Dictionary } from "@/lib/i18n/en";
import { LINE_ITEM_FIELDS, SCALAR_FIELDS } from "@/lib/schema";
import { displayStatus, documentStatus, fieldsNeedingReview, lineStatus, type DisplayStatus } from "@/lib/status";

/**
 * Format-neutral table model shared by the CSV and XLSX writers.
 * Every cell carries its display status so writers can colour it.
 */

export type ExportDoc = { fileName: string; consensus: ConsensusResult; validation: ValidationResult };
export type Cell = { value: string | number | null; status?: DisplayStatus; kind?: "money" | "number" };
export type Table = { header: string[]; rows: Cell[][] };

type Labels = { t: Dictionary; warning: (w: ValidationWarning) => string };

export function receiptsTable(docs: ExportDoc[], { t, warning }: Labels): Table {
  const header = [
    t.export.colFile,
    ...SCALAR_FIELDS.map((f) => t.fields[f]),
    t.export.colItemsSum,
    t.export.colTaxMode,
    t.export.colStatus,
    t.export.colReview,
    t.export.colWarnings,
  ];
  const rows = docs.map(({ fileName, consensus: c, validation: v }) => [
    { value: fileName },
    ...SCALAR_FIELDS.map((f): Cell => ({
      value: c.fields[f].value,
      status: displayStatus(c.fields[f]),
      kind: f === "subtotal" || f === "tax" || f === "total" ? "money" : undefined,
    })),
    { value: v.itemsSum, kind: "money" as const },
    { value: t.detail.taxMode[v.taxMode] },
    {
      value: c.fallback ? `${t.status[documentStatus(c)]} (${t.detail.fallbackShort})` : t.status[documentStatus(c)],
      status: documentStatus(c),
    },
    { value: fieldsNeedingReview(c).map((f) => t.fields[f]).join(", ") },
    { value: v.warnings.map(warning).join(" | ") },
  ]);
  return { header, rows };
}

export function lineItemsTable(docs: ExportDoc[], { t }: Labels): Table {
  const header = [
    t.export.colFile,
    t.fields.merchant,
    t.fields.date,
    t.export.colLine,
    ...LINE_ITEM_FIELDS.map((f) => t.fields[f]),
    t.table.status,
  ];
  const rows = docs.flatMap(({ fileName, consensus: c }) =>
    c.line_items.items.map((item, i) => [
      { value: fileName },
      { value: c.fields.merchant.value },
      { value: c.fields.date.value },
      { value: i + 1 },
      ...LINE_ITEM_FIELDS.map((f): Cell => ({
        value: item[f].value,
        status: displayStatus(item[f]),
        kind: f === "qty" ? "number" : f === "name" ? undefined : "money",
      })),
      { value: t.status[lineStatus(item)], status: lineStatus(item) },
    ]),
  );
  return { header, rows };
}
