"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtractSuccess } from "@/lib/api-types";
import { addLineItem, editField, editLineItem, removeLineItem } from "@/lib/client/edit";
import { LINE_ITEM_KINDS } from "@/lib/consensus/compare";
import { normalizeCurrency, parseLocaleNumber } from "@/lib/consensus/normalize";
import type { FieldResult, Reader } from "@/lib/consensus/types";
import { useI18n } from "@/lib/i18n";
import { FIELD_KINDS, LINE_ITEM_FIELDS, SCALAR_FIELDS, type FieldKind } from "@/lib/schema";
import { displayStatus, documentStatus, lineStatus } from "@/lib/status";
import type { DocItem } from "./ReaderApp";
import { Icon, STATUS_STYLES, StatusBadge, buttonClass } from "./ui";

type Value = string | number | null;
const READERS: Reader[] = ["a", "b", "arbiter"];

/** Turns user input back into a typed value; returns undefined when the input is invalid. */
function parseInput(kind: FieldKind, raw: string): Value | undefined {
  const s = raw.trim();
  if (s === "") return null;
  // Currency symbols are fine ("₺ 45,00"), letters are not ("175,80abc").
  if (kind === "number") return /\p{L}/u.test(s) ? undefined : (parseLocaleNumber(s) ?? undefined);
  if (kind === "currency") return normalizeCurrency(s);
  return s;
}

/** Quantities are shown without forced decimals (2, 1,25); money always with two. */
function useFormatValue() {
  const { t, num, numPlain } = useI18n();
  return (kind: FieldKind, v: Value | undefined, plain = false) =>
    v === undefined
      ? t.detail.notRead
      : v === null
        ? t.detail.nullValue
        : kind === "number"
          ? (plain ? numPlain : num)(v as number)
          : String(v);
}

function ValueInput({
  kind,
  field,
  label,
  onCommit,
  plain = false,
  className = "",
}: {
  kind: FieldKind;
  field: FieldResult<Value>;
  label: string;
  onCommit: (v: Value) => void;
  plain?: boolean;
  className?: string;
}) {
  const fmt = useFormatValue();
  const shown = field.value == null ? "" : fmt(kind, field.value, plain);
  const [draft, setDraft] = useState(shown);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    if (draft === shown) return;
    const parsed = parseInput(kind, draft);
    if (parsed === undefined) return setInvalid(true);
    setInvalid(false);
    onCommit(parsed);
  };

  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      value={draft}
      inputMode={kind === "number" ? "decimal" : undefined}
      placeholder={kind === "date" ? "YYYY-MM-DD" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          // Revert the draft instead of closing the panel.
          e.stopPropagation();
          setDraft(shown);
        }
      }}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-sm text-zinc-900 transition outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-100 ${
        kind === "number" ? "text-right tabular-nums" : ""
      } ${invalid ? "border-red-500 ring-2 ring-red-300" : STATUS_STYLES[displayStatus(field)].field} ${className}`}
    />
  );
}

/** A/B/arbiter readings as chips; the majority is highlighted and any chip can be adopted. */
function Candidates({
  kind,
  field,
  onPick,
  plain = false,
}: {
  kind: FieldKind;
  field: FieldResult<Value>;
  onPick: (v: Value) => void;
  plain?: boolean;
}) {
  const { t } = useI18n();
  const fmt = useFormatValue();
  if (field.status === "agreed" && !field.edited) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {READERS.filter((r) => r in field.candidates).map((r) => {
        const v = field.candidates[r] as Value;
        const inMajority = field.majority.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(v)}
            title={`${t.detail.use}: ${fmt(kind, v, plain)}`}
            className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition hover:border-zinc-500 ${
              inMajority
                ? "border-sky-300 bg-sky-50 font-semibold text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
                : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            <span className="font-bold uppercase opacity-70">{r === "arbiter" ? t.detail.reader.arbiter : r}</span>
            <span className="truncate">{fmt(kind, v, plain)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ReceiptDetail({
  doc,
  liveModels,
  onChange,
  onClose,
}: {
  doc: DocItem;
  liveModels: { a: string; b: string; arbiter: string } | null;
  onChange: (result: ExtractSuccess) => void;
  onClose: () => void;
}) {
  const { t, f, warning, notice } = useI18n();
  const result = doc.result!;
  const c = result.consensus;
  const v = result.validation;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Mount-only: focusing the close button on every render would steal focus from inputs.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const models = result.models ?? (result.source === "live" ? liveModels : null);
  // Illustrative replays never claim a model; recorded ones carry their own labels.
  // The fallback banner already explains a failed extractor.
  const otherNotices = c.fallback ? result.notices.filter((n) => n.code !== "extractor_failed") : result.notices;
  const { extractMs, arbiterMs, totalMs } = result.timings;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button type="button" aria-label={t.detail.close} className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onClose} tabIndex={-1} />
      <div className="relative flex h-full w-full max-w-6xl flex-col bg-zinc-50 shadow-2xl dark:bg-zinc-950">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-3">
            <h2 id="detail-title" className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {doc.fileName}
            </h2>
            <StatusBadge status={documentStatus(c)} />
          </div>
          <button ref={closeRef} type="button" className={buttonClass.secondary} onClick={onClose}>
            <Icon.x width={14} height={14} />
            {t.detail.close}
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:overflow-hidden">
          {/* Preview */}
          <div className="border-b border-zinc-200 bg-zinc-100 p-4 lg:overflow-y-auto lg:border-r lg:border-b-0 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="sr-only">{t.detail.preview}</h3>
            {doc.pdfUrl && !doc.previewUrl ? (
              <iframe src={doc.pdfUrl} title={t.detail.preview} className="h-[70vh] w-full rounded-lg border border-zinc-200 bg-white lg:h-full dark:border-zinc-700" />
            ) : doc.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URLs / static previews
              <img src={doc.previewUrl} alt={t.detail.preview} className="mx-auto max-h-[70vh] rounded-lg shadow-sm lg:max-h-none" />
            ) : null}
          </div>

          {/* Fields */}
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <section className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <p>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.detail.models}: </span>
                {result.source === "replay"
                  ? models
                    ? f(t.detail.recorded, {
                        models: `A ${models.a} · B ${models.b} · ${t.detail.reader.arbiter} ${models.arbiter}`,
                        date: result.recordedAt?.slice(0, 10) ?? "—",
                      })
                    : t.detail.replay
                  : models
                    ? `A ${models.a} · B ${models.b} · ${t.detail.reader.arbiter} ${models.arbiter}`
                    : "—"}
              </p>
              {!c.fallback && (
                <p>{c.disputed.length ? f(t.detail.disputed, { fields: c.disputed.map((d) => t.fields[d]).join(", ") }) : t.detail.noDisputes}</p>
              )}
              {result.source === "live" && (
                <p className="tabular-nums">{f(t.detail.timings, { a: extractMs, b: arbiterMs ?? t.detail.noArbiter, c: totalMs })}</p>
              )}
            </section>

            {c.fallback && <FallbackBanner result={result} />}

            {otherNotices.length > 0 && (
              <ul className="space-y-1.5">
                {otherNotices.map((n, i) => (
                  <li key={i} className="flex gap-2 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <Icon.info width={14} height={14} className="mt-px shrink-0" />
                    {notice(n)}
                  </li>
                ))}
              </ul>
            )}

            <section
              className={`rounded-xl border p-3.5 text-sm ${
                v.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200"
              }`}
              aria-live="polite"
            >
              <p className="flex items-center gap-2 font-semibold">
                {v.ok ? <Icon.check width={14} height={14} /> : <Icon.alert width={14} height={14} />}
                {t.validation.title}
                <span className="font-normal opacity-80">· {t.detail.taxMode[v.taxMode]}</span>
              </p>
              {v.ok ? (
                <p className="mt-1 opacity-90">{t.validation.ok}</p>
              ) : (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {v.warnings.map((w, i) => (
                    <li key={i}>{warning(w)}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              {SCALAR_FIELDS.map((field) => {
                const fr = c.fields[field] as FieldResult<Value>;
                const commit = (value: Value) => onChange(editField(result, field, value as never));
                return (
                  <div key={field}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.fields[field]}</label>
                      <StatusBadge status={displayStatus(fr)} />
                    </div>
                    <ValueInput key={String(fr.value)} kind={FIELD_KINDS[field]} field={fr} label={t.fields[field]} onCommit={commit} />
                    <Candidates kind={FIELD_KINDS[field]} field={fr} onPick={commit} />
                  </div>
                );
              })}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t.fields.line_items}
                  <StatusBadge status={c.line_items.items.length ? worstLine(c.line_items.items.map(lineStatus)) : "agreed"} />
                </h3>
                <button type="button" className={buttonClass.secondary} onClick={() => onChange(addLineItem(result))}>
                  <Icon.plus width={14} height={14} />
                  {t.detail.addLine}
                </button>
              </div>
              {c.line_items.discarded.length > 0 && (
                <p className="mb-2 text-xs text-sky-800 dark:text-sky-300">
                  {f(t.detail.discarded, { n: c.line_items.discarded.length })}{" "}
                  <span className="opacity-75">({c.line_items.discarded.map((d) => `${d.reader.toUpperCase()}: ${d.item.name}`).join(", ")})</span>
                </p>
              )}
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                      <th className="w-8 px-2 py-2 text-center">#</th>
                      {LINE_ITEM_FIELDS.map((lf) => (
                        <th key={lf} className={`px-2 py-2 font-medium ${lf === "name" ? "w-[38%]" : "text-right"}`}>
                          {t.fields[lf]}
                        </th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 align-top dark:divide-zinc-800">
                    {c.line_items.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 text-center text-xs text-zinc-400 tabular-nums">
                          <span className={`mx-auto mb-1 block size-1.5 rounded-full ${STATUS_STYLES[lineStatus(item)].dot}`} title={t.status[lineStatus(item)]} />
                          {index + 1}
                        </td>
                        {LINE_ITEM_FIELDS.map((lf) => {
                          const fr = item[lf] as FieldResult<Value>;
                          const kind = LINE_ITEM_KINDS[lf];
                          const commit = (value: Value) => onChange(editLineItem(result, index, lf, value as never));
                          return (
                            <td key={lf} className="px-1.5 py-1.5">
                              <ValueInput
                                key={String(fr.value)}
                                kind={kind}
                                field={fr}
                                label={`${t.fields[lf]} ${index + 1}`}
                                onCommit={commit}
                                plain={lf === "qty"}
                                className="py-1 text-[13px]"
                              />
                              <Candidates kind={kind} field={fr} onPick={commit} plain={lf === "qty"} />
                            </td>
                          );
                        })}
                        <td className="px-1 py-1.5">
                          <button
                            type="button"
                            className={buttonClass.ghost}
                            onClick={() => onChange(removeLineItem(result, index))}
                            aria-label={`${t.detail.removeLine} ${index + 1}`}
                            title={t.detail.removeLine}
                          >
                            <Icon.trash width={14} height={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Prominent, so a two-reader fallback is never mistaken for a 2-of-3 consensus. */
function FallbackBanner({ result }: { result: ExtractSuccess }) {
  const { t, f } = useI18n();
  const failed = result.consensus.fallback!.failedReader;
  const notice = result.notices.find((n) => n.code === "extractor_failed");
  return (
    <section
      role="alert"
      className="rounded-xl border-2 border-dashed border-teal-500 bg-teal-50 p-3.5 text-sm text-teal-950 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-100"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon.swap width={14} height={14} />
        {t.detail.fallbackTitle}
      </p>
      <p className="mt-1 leading-relaxed opacity-90">
        {f(t.detail.fallbackBody, {
          reader: failed.toUpperCase(),
          error: notice && notice.code === "extractor_failed" ? notice.error : "—",
          label: t.status.fallback_agreed,
        })}
      </p>
    </section>
  );
}

function worstLine(statuses: ReturnType<typeof lineStatus>[]) {
  if (statuses.includes("needs_review")) return "needs_review";
  if (statuses.includes("fallback_agreed")) return "fallback_agreed";
  if (statuses.includes("arbitrated")) return "arbitrated";
  if (statuses.includes("edited")) return "edited";
  return "agreed";
}
