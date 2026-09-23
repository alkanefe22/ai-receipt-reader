"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtractErrorCode, ExtractResponse, ExtractSuccess } from "@/lib/api-types";
import { prepareUpload } from "@/lib/client/resize";
import type { DemoSample } from "@/lib/demo/samples";
import { DemoBanner, Header } from "./Header";
import { ExportBar } from "./ExportBar";
import { ReceiptDetail } from "./ReceiptDetail";
import { ResultsTable } from "./ResultsTable";
import { SampleGallery } from "./SampleGallery";
import { StatusLegend } from "./ui";
import { UploadDropzone } from "./UploadDropzone";

export type AppInfo = {
  mode: "live" | "demo";
  demoReason?: "forced" | "missing-keys" | "missing-models";
  models: { a: string; b: string; arbiter: string } | null;
  maxFileMb: number;
  samples: DemoSample[];
};

type Source = { kind: "sample"; sampleId: string } | { kind: "file"; file: File };

export type ClientError = { code: ExtractErrorCode | "network" | "generic"; retryAfterSeconds?: number };

export type DocItem = {
  key: string;
  fileName: string;
  /** Image URL for thumbnails/preview (sample preview or object URL of an uploaded image). */
  previewUrl: string | null;
  /** Object URL / public path of a PDF, shown in an iframe. */
  pdfUrl: string | null;
  state: "queued" | "processing" | "done" | "error";
  result?: ExtractSuccess;
  error?: ClientError;
};

/** Parallel requests from one browser; each request already fans out to 2–3 model calls. */
const CONCURRENCY = 3;

async function requestExtraction(source: Source): Promise<ExtractSuccess> {
  const form = new FormData();
  if (source.kind === "sample") form.append("sampleId", source.sampleId);
  else form.append("file", await prepareUpload(source.file), source.file.name);

  let res: Response;
  try {
    res = await fetch("/api/extract", { method: "POST", body: form });
  } catch {
    throw { code: "network" } satisfies ClientError;
  }
  const body = (await res.json().catch(() => null)) as ExtractResponse | null;
  if (!body) throw { code: "generic" } satisfies ClientError;
  if ("error" in body) throw { code: body.error.code, retryAfterSeconds: body.error.retryAfterSeconds } satisfies ClientError;
  return body;
}

export function ReaderApp({ info }: { info: AppInfo }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const sources = useRef(new Map<string, Source>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const objectUrls = useRef(new Set<string>());

  const patch = useCallback((key: string, next: Partial<DocItem>) => {
    setDocs((ds) => ds.map((d) => (d.key === key ? { ...d, ...next } : d)));
  }, []);

  const pump = useCallback(() => {
    const next = () => {
      while (running.current < CONCURRENCY && queue.current.length > 0) {
        const key = queue.current.shift()!;
        const source = sources.current.get(key);
        if (!source) continue; // removed while queued
        running.current++;
        patch(key, { state: "processing", error: undefined });
        requestExtraction(source)
          .then((result) => patch(key, { state: "done", result }))
          .catch((error: ClientError) => patch(key, { state: "error", error: error?.code ? error : { code: "generic" } }))
          .finally(() => {
            running.current--;
            next();
          });
      }
    };
    next();
  }, [patch]);

  const enqueue = useCallback(
    (items: { source: Source; fileName: string; previewUrl: string | null; pdfUrl: string | null }[]) => {
      const created = items.map((item) => {
        const key = crypto.randomUUID();
        sources.current.set(key, item.source);
        queue.current.push(key);
        return { key, fileName: item.fileName, previewUrl: item.previewUrl, pdfUrl: item.pdfUrl, state: "queued" as const };
      });
      setDocs((ds) => [...ds, ...created]);
      pump();
    },
    [pump],
  );

  const addSamples = (samples: DemoSample[]) =>
    enqueue(
      samples.map((s) => ({
        source: { kind: "sample", sampleId: s.id },
        fileName: s.fileName,
        previewUrl: s.preview,
        pdfUrl: s.file.endsWith(".pdf") ? s.file : null,
      })),
    );

  const addFiles = (files: File[]) =>
    enqueue(
      files.map((file) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        return { source: { kind: "file", file }, fileName: file.name, previewUrl: isPdf ? null : url, pdfUrl: isPdf ? url : null };
      }),
    );

  const releaseUrls = (doc: DocItem) => {
    for (const url of [doc.previewUrl, doc.pdfUrl]) {
      if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url);
    }
  };

  const remove = (key: string) => {
    const doc = docs.find((d) => d.key === key);
    if (doc) releaseUrls(doc);
    sources.current.delete(key);
    setDocs((ds) => ds.filter((d) => d.key !== key));
    if (selected === key) setSelected(null);
  };

  const clearAll = () => {
    docs.forEach(releaseUrls);
    sources.current.clear();
    queue.current = [];
    setDocs([]);
    setSelected(null);
  };

  const retry = (key: string) => {
    if (!sources.current.has(key)) return;
    patch(key, { state: "queued", error: undefined });
    queue.current.push(key);
    pump();
  };

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const selectedDoc = docs.find((d) => d.key === selected && d.state === "done");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Header mode={info.mode} />
      {info.mode === "demo" && <DemoBanner forced={info.demoReason === "forced"} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <UploadDropzone disabled={info.mode === "demo"} maxFileMb={info.maxFileMb} onFiles={addFiles} />
        </div>
        <div className="lg:col-span-3">
          <SampleGallery samples={info.samples} onRun={addSamples} />
        </div>
      </div>

      <ResultsTable docs={docs} onOpen={setSelected} onRemove={remove} onRetry={retry} onClear={clearAll} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <StatusLegend />
        <ExportBar docs={docs} />
      </div>

      {selectedDoc && (
        <ReceiptDetail
          doc={selectedDoc}
          liveModels={info.models}
          onChange={(result) => patch(selectedDoc.key, { result })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
