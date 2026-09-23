"use client";

import type { DemoSample } from "@/lib/demo/samples";
import { useI18n } from "@/lib/i18n";
import { Card, Icon, buttonClass } from "./ui";

export function SampleGallery({ samples, onRun }: { samples: DemoSample[]; onRun: (samples: DemoSample[]) => void }) {
  const { t } = useI18n();
  return (
    <Card
      title={t.samples.title}
      actions={
        <button type="button" className={buttonClass.primary} onClick={() => onRun(samples)}>
          <Icon.play width={14} height={14} />
          {t.samples.runAll}
        </button>
      }
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {samples.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onRun([s])}
              className="group flex w-full flex-col overflow-hidden rounded-xl border border-zinc-200 text-left transition hover:border-zinc-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:border-zinc-800 dark:hover:border-zinc-600"
              title={`${t.samples.run}: ${s.fileName}`}
            >
              <span className="relative block aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element -- static sample thumbnails */}
                <img src={s.preview} alt="" className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]" />
                <span className="absolute top-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 uppercase shadow-sm dark:bg-zinc-900/90 dark:text-zinc-200">
                  {s.lang}
                  {s.file.endsWith(".pdf") && " · pdf"}
                </span>
              </span>
              <span className="block p-2 text-xs leading-snug text-zinc-700 dark:text-zinc-300">{t.samples.scenario[s.scenario]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
