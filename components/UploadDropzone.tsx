"use client";

import { useRef, useState, type DragEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, Icon, buttonClass } from "./ui";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ACCEPT_EXT = /\.(jpe?g|png|webp|pdf)$/i;

export function UploadDropzone({
  disabled,
  maxFileMb,
  onFiles,
}: {
  disabled: boolean;
  maxFileMb: number;
  onFiles: (files: File[]) => void;
}) {
  const { t, f } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const accept = (list: FileList | null) => {
    if (!list || disabled) return;
    const ok: File[] = [];
    const bad: string[] = [];
    for (const file of Array.from(list)) {
      // Client check is for UX only; the server re-validates by magic bytes.
      if (!ACCEPT.includes(file.type) && !ACCEPT_EXT.test(file.name)) bad.push(f(t.upload.rejected, { name: file.name }));
      else if (file.size > maxFileMb * 1024 * 1024) bad.push(f(t.upload.tooLarge, { name: file.name, mb: maxFileMb }));
      else ok.push(file);
    }
    setRejected(bad);
    if (ok.length) onFiles(ok);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files);
  };

  return (
    <Card title={t.upload.title} className="h-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition ${
          disabled
            ? "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50"
            : dragging
              ? "border-sky-400 bg-sky-50 dark:bg-sky-950/30"
              : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700"
        }`}
      >
        <Icon.upload width={28} height={28} className={disabled ? "" : "text-zinc-500"} />
        <p className="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
          {disabled ? t.upload.disabledDemo : f(t.upload.hint, { mb: maxFileMb })}
        </p>
        <button type="button" className={buttonClass.primary} disabled={disabled} onClick={() => input.current?.click()}>
          {t.upload.choose}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {rejected.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-400" role="alert">
          {rejected.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
