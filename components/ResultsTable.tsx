"use client";

import { useI18n } from "@/lib/i18n";
import { countNeedingReview, displayStatus, documentStatus } from "@/lib/status";
import type { ClientError, DocItem } from "./ReaderApp";
import { Card, Icon, STATUS_STYLES, StatusBadge, buttonClass } from "./ui";

export function useErrorText() {
  const { t, f } = useI18n();
  return (e: ClientError | undefined) => {
    if (!e) return t.errors.generic;
    if (e.code === "rate_limited") return f(t.errors.rate_limited, { s: e.retryAfterSeconds ?? 60 });
    return (t.errors as Record<string, string>)[e.code] ?? t.errors.generic;
  };
}

export function ResultsTable({
  docs,
  onOpen,
  onRemove,
  onRetry,
  onClear,
}: {
  docs: DocItem[];
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onClear: () => void;
}) {
  const { t, f, num } = useI18n();
  const errorText = useErrorText();

  return (
    <Card
      title={t.table.title}
      actions={
        docs.length > 0 && (
          <button type="button" className={buttonClass.ghost} onClick={onClear}>
            <Icon.trash width={14} height={14} />
            {t.table.clear}
          </button>
        )
      }
    >
      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {t.table.empty}
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3 pl-5">{t.table.file}</th>
                <th className="px-3 py-2">{t.table.merchant}</th>
                <th className="px-3 py-2">{t.table.date}</th>
                <th className="px-3 py-2 text-right">{t.table.total}</th>
                <th className="px-3 py-2">{t.table.status}</th>
                <th className="px-3 py-2">{t.table.checks}</th>
                <th className="py-2 pr-5 pl-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {docs.map((doc) => {
                const c = doc.result?.consensus;
                const v = doc.result?.validation;
                const pending = c ? countNeedingReview(c) : 0;
                const cell = (field: "merchant" | "date" | "total") =>
                  c && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`size-1.5 shrink-0 rounded-full ${STATUS_STYLES[displayStatus(c.fields[field])].dot}`} aria-hidden />
                      {field === "total"
                        ? `${num(c.fields.total.value)} ${c.fields.currency.value ?? ""}`
                        : (c.fields[field].value ?? "—")}
                    </span>
                  );
                return (
                  <tr
                    key={doc.key}
                    className={`transition ${doc.state === "done" ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40" : ""}`}
                    onClick={() => doc.state === "done" && onOpen(doc.key)}
                  >
                    <td className="py-2.5 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                          {doc.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- object URLs / static previews
                            <img src={doc.previewUrl} alt="" className="h-full w-full object-cover object-top" />
                          ) : (
                            <Icon.file className="text-zinc-400" />
                          )}
                        </span>
                        <span className="max-w-48 truncate font-medium text-zinc-800 dark:text-zinc-200" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    {doc.state === "done" && c && v ? (
                      <>
                        <td className="max-w-56 truncate px-3 py-2.5">{cell("merchant")}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{cell("date")}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{cell("total")}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={documentStatus(c)} />
                            {pending > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">×{pending}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {v.ok ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <Icon.check width={12} height={12} /> {t.table.ok}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Icon.alert width={12} height={12} /> {f(t.table.warnings, { n: v.warnings.length })}
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-3 py-2.5 text-sm">
                        {doc.state === "error" ? (
                          <span className="inline-flex items-center gap-2 text-red-700 dark:text-red-400">
                            <Icon.alert width={14} height={14} />
                            {t.table.error}: {errorText(doc.error)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-zinc-500">
                            {doc.state === "processing" ? <Icon.spinner width={14} height={14} /> : <span className="size-2 rounded-full bg-zinc-300" />}
                            {doc.state === "processing" ? t.table.processing : t.table.queued}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 pr-5 pl-3">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {doc.state === "done" && (
                          <button type="button" className={buttonClass.secondary} onClick={() => onOpen(doc.key)}>
                            {t.table.open}
                          </button>
                        )}
                        {doc.state === "error" && doc.error?.code !== "demo_upload_disabled" && (
                          <button type="button" className={buttonClass.secondary} onClick={() => onRetry(doc.key)}>
                            {t.table.retry}
                          </button>
                        )}
                        <button type="button" className={buttonClass.ghost} onClick={() => onRemove(doc.key)} aria-label={t.table.remove} title={t.table.remove}>
                          <Icon.x width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
