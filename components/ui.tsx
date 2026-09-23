"use client";

import type { ReactNode, SVGProps } from "react";
import { useI18n } from "@/lib/i18n";
import type { DisplayStatus } from "@/lib/status";

/** Status colours — never the only signal: badges also carry an icon and a label. */
export const STATUS_STYLES: Record<DisplayStatus, { field: string; badge: string; dot: string }> = {
  agreed: {
    field: "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700/70 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-900/50 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  arbitrated: {
    field: "border-sky-300 bg-sky-50/70 dark:border-sky-700/70 dark:bg-sky-950/30",
    badge: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-900/50 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  fallback_agreed: {
    field: "border-dashed border-teal-400 bg-teal-50/60 dark:border-teal-600/80 dark:bg-teal-950/30",
    badge: "bg-teal-100 text-teal-900 ring-teal-600/30 dark:bg-teal-900/50 dark:text-teal-200",
    dot: "bg-teal-500",
  },
  needs_review: {
    field: "border-amber-400 bg-amber-50 ring-2 ring-amber-300/50 dark:border-amber-500/80 dark:bg-amber-950/40 dark:ring-amber-500/30",
    badge: "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-900/50 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  edited: {
    field: "border-violet-300 bg-violet-50/70 dark:border-violet-700/70 dark:bg-violet-950/30",
    badge: "bg-violet-100 text-violet-800 ring-violet-600/20 dark:bg-violet-900/50 dark:text-violet-200",
    dot: "bg-violet-500",
  },
};

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const Icon = {
  check: (p: IconProps) => <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>,
  scale: (p: IconProps) => (
    <svg {...base(p)}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z" /></svg>
  ),
  alert: (p: IconProps) => (
    <svg {...base(p)}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
  ),
  pencil: (p: IconProps) => <svg {...base(p)}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  upload: (p: IconProps) => <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  file: (p: IconProps) => (
    <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
  ),
  x: (p: IconProps) => <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  plus: (p: IconProps) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  trash: (p: IconProps) => <svg {...base(p)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  download: (p: IconProps) => <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>,
  spinner: (p: IconProps) => (
    <svg {...base(p)} className={`animate-spin ${p.className ?? ""}`}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>
  ),
  play: (p: IconProps) => <svg {...base(p)}><path d="m6 4 14 8-14 8Z" /></svg>,
  swap: (p: IconProps) => <svg {...base(p)}><path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" /></svg>,
  info: (p: IconProps) => <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>,
};

const STATUS_ICON: Record<DisplayStatus, (p: IconProps) => ReactNode> = {
  agreed: Icon.check,
  arbitrated: Icon.scale,
  fallback_agreed: Icon.swap,
  needs_review: Icon.alert,
  edited: Icon.pencil,
};

export function StatusBadge({ status, compact = false }: { status: DisplayStatus; compact?: boolean }) {
  const { t } = useI18n();
  const StatusIcon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_STYLES[status].badge}`}
      title={t.status.legend[status]}
    >
      <StatusIcon width={12} height={12} />
      {compact ? <span className="sr-only">{t.status[status]}</span> : t.status[status]}
    </span>
  );
}

export function StatusLegend() {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
      {(["agreed", "arbitrated", "fallback_agreed", "needs_review", "edited"] as const).map((s) => (
        <li key={s} className="flex items-center gap-2">
          <StatusBadge status={s} />
          <span>{t.status.legend[s]}</span>
        </li>
      ))}
    </ul>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
};
