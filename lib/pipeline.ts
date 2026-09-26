import { applyFallback, consensusToReceipt, resolveConsensus, runConsensus } from "@/lib/consensus/consensus";
import type { ConsensusResult } from "@/lib/consensus/types";
import { validateReceipt, type ValidationResult } from "@/lib/consensus/validate";
import type { Receipt, ReceiptField } from "@/lib/schema";

/**
 * Transport-agnostic pipeline: the same code runs live (real model calls) and
 * in demo mode (recorded responses) — only the `Readers` differ.
 */
export type Readers = {
  extractA: () => Promise<Receipt>;
  extractB: () => Promise<Receipt>;
  /** Blind read of the given fields only. */
  arbitrate: (fields: ReceiptField[]) => Promise<Partial<Receipt>>;
  /** Full read by the arbiter model, used when one extractor fails. */
  substitute?: () => Promise<Receipt>;
};

export type Notice =
  | { code: "pdf_pages"; pageCount: number; rendered: boolean }
  | { code: "extractor_failed"; reader: "a" | "b"; substituted: boolean; error: string }
  | { code: "arbiter_failed"; error: string };

export type Timings = { extractMs: number; arbiterMs: number | null; totalMs: number };

export type PipelineResult = {
  consensus: ConsensusResult;
  validation: ValidationResult;
  notices: Notice[];
  timings: Timings;
};

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly errors: { a: string; b: string },
  ) {
    super(message);
  }
}

export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

export async function runPipeline(readers: Readers, notices: Notice[] = []): Promise<PipelineResult> {
  const started = performance.now();

  // Both primary readers run in parallel.
  const [ra, rb] = await Promise.allSettled([readers.extractA(), readers.extractB()]);
  const extractMs = Math.round(performance.now() - started);

  let a: Receipt;
  let b: Receipt;
  if (ra.status === "fulfilled" && rb.status === "fulfilled") {
    [a, b] = [ra.value, rb.value];
  } else if (ra.status === "rejected" && rb.status === "rejected") {
    throw new PipelineError("Both extractors failed", { a: errorMessage(ra.reason), b: errorMessage(rb.reason) });
  } else {
    // One reader failed: let the arbiter model read the whole document in its place,
    // so a 2-reader comparison is still possible. No third vote remains after that.
    const failed = ra.status === "rejected" ? "a" : "b";
    const error = errorMessage(ra.status === "rejected" ? ra.reason : (rb as PromiseRejectedResult).reason);
    const survivor = (ra.status === "fulfilled" ? ra.value : (rb as PromiseFulfilledResult<Receipt>).value);
    let replacement: Receipt;
    try {
      if (!readers.substitute) throw new Error("no substitute reader");
      replacement = await readers.substitute();
    } catch (subErr) {
      throw new PipelineError("Extractor failed and substitute read failed", {
        a: failed === "a" ? error : errorMessage(subErr),
        b: failed === "b" ? error : errorMessage(subErr),
      });
    }
    notices.push({ code: "extractor_failed", reader: failed, substituted: true, error });
    [a, b] = failed === "a" ? [replacement, survivor] : [survivor, replacement];
    // Two readers only: agreements are flagged as fallback, disagreements need review.
    const consensus = applyFallback(resolveConsensus(a, b), failed);
    return finish(consensus, notices, { extractMs, arbiterMs: null, started });
  }

  const arbiterStarted = performance.now();
  let arbiterMs: number | null = null;
  const consensus = await runConsensus(a, b, async (fields) => {
    try {
      return await readers.arbitrate(fields);
    } finally {
      arbiterMs = Math.round(performance.now() - arbiterStarted);
    }
  });
  if (consensus.arbiterError) notices.push({ code: "arbiter_failed", error: consensus.arbiterError });
  return finish(consensus, notices, { extractMs, arbiterMs, started });
}

function finish(
  consensus: ConsensusResult,
  notices: Notice[],
  t: { extractMs: number; arbiterMs: number | null; started: number },
): PipelineResult {
  return {
    consensus,
    validation: validateReceipt(consensusToReceipt(consensus)),
    notices,
    timings: { extractMs: t.extractMs, arbiterMs: t.arbiterMs, totalMs: Math.round(performance.now() - t.started) },
  };
}
