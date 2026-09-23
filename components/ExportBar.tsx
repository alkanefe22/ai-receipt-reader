"use client";

import { useState } from "react";
import { toCsv } from "@/lib/export/csv";
import { lineItemsTable, receiptsTable, type ExportDoc } from "@/lib/export/rows";
import { toXlsx } from "@/lib/export/xlsx";
import { useI18n } from "@/lib/i18n";
import { countNeedingReview } from "@/lib/status";
import type { DocItem } from "./ReaderApp";
import { Icon, buttonClass } from "./ui";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function ExportBar({ docs }: { docs: DocItem[] }) {
  const { t, f, warning } = useI18n();
  const [busy, setBusy] = useState(false);

  const ready: ExportDoc[] = docs.flatMap((d) =>
    d.state === "done" && d.result ? [{ fileName: d.fileName, consensus: d.result.consensus, validation: d.result.validation }] : [],
  );
  const pending = ready.reduce((n, d) => n + countNeedingReview(d.consensus), 0);
  const labels = { t, warning };
  const disabled = ready.length === 0 || busy;

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const blob = await toXlsx(
        [
          { name: t.export.sheetReceipts, table: receiptsTable(ready, labels) },
          { name: t.export.sheetItems, table: lineItemsTable(ready, labels) },
        ],
        {
          title: t.export.sheetLegend,
          rows: (["agreed", "arbitrated", "fallback_agreed", "needs_review", "edited"] as const).map((s) => [s, t.status[s], t.status.legend[s]]),
        },
      );
      download(blob, `receipts-${stamp()}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (kind: "receipts" | "items") => {
    const table = kind === "receipts" ? receiptsTable(ready, labels) : lineItemsTable(ready, labels);
    download(new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" }), `${kind === "receipts" ? "receipts" : "line-items"}-${stamp()}.csv`);
  };

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.export.title}</span>
        <button type="button" className={buttonClass.primary} disabled={disabled} onClick={exportXlsx}>
          {busy ? <Icon.spinner width={14} height={14} /> : <Icon.download width={14} height={14} />}
          {t.export.xlsx}
        </button>
        <button type="button" className={buttonClass.secondary} disabled={disabled} onClick={() => exportCsv("receipts")}>
          {t.export.csvReceipts}
        </button>
        <button type="button" className={buttonClass.secondary} disabled={disabled} onClick={() => exportCsv("items")}>
          {t.export.csvItems}
        </button>
      </div>
      {ready.length === 0 ? (
        <p className="text-xs text-zinc-500">{t.export.nothing}</p>
      ) : (
        pending > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{f(t.export.pending, { n: pending })}</p>
      )}
    </div>
  );
}
