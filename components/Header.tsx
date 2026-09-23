"use client";

import { LANGS, useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

export function Header({ mode }: { mode: "live" | "demo" }) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">{t.app.title}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
              mode === "demo"
                ? "bg-violet-100 text-violet-800 ring-violet-600/20 dark:bg-violet-900/40 dark:text-violet-200"
                : "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-900/40 dark:text-emerald-200"
            }`}
          >
            {mode === "demo" ? t.mode.demo : t.mode.live}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.app.tagline}</p>
        {mode === "live" && <p className="mt-1 text-xs text-zinc-500">{t.mode.liveInfo}</p>}
      </div>
      <LanguageToggle />
    </header>
  );
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t.lang.label} className="inline-flex shrink-0 self-start rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition ${
            lang === l
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
          title={t.lang[l]}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function DemoBanner({ forced }: { forced: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-200">
      <Icon.info className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{t.mode.demoBanner.title}</p>
        <p className="mt-1 text-violet-800/90 dark:text-violet-200/80">
          {forced ? t.mode.demoBanner.forced : t.mode.demoBanner.body}
        </p>
      </div>
    </div>
  );
}
