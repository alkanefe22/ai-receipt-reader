import "server-only";
import { generateText, Output } from "ai";
import type { AppConfig, ModelSpec } from "@/lib/config";
import type { PreparedDocument } from "@/lib/document";
import { ARBITER_INSTRUCTIONS, EXTRACTION_INSTRUCTIONS, EXTRACTION_PROMPT, arbiterPrompt } from "@/lib/prompts";
import { ReceiptSchema, partialReceiptSchema, type Receipt, type ReceiptField } from "@/lib/schema";
import { getModel } from "./index";

type CallOptions = { config: AppConfig; abortSignal?: AbortSignal };

function documentMessage(doc: PreparedDocument, text: string) {
  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        { type: "file" as const, data: doc.data, mediaType: doc.mediaType },
      ],
    },
  ];
}

/** Full extraction by one of the two primary readers. */
export async function extractReceipt(spec: ModelSpec, doc: PreparedDocument, opts: CallOptions): Promise<Receipt> {
  const { output } = await generateText({
    model: getModel(spec, opts.config.keys),
    instructions: EXTRACTION_INSTRUCTIONS,
    messages: documentMessage(doc, EXTRACTION_PROMPT),
    output: Output.object({ schema: ReceiptSchema }),
    temperature: 0,
    timeout: opts.config.modelTimeoutMs,
    // A retry re-sends the whole image; on free quotas a fast failure beats burning quota.
    maxRetries: opts.config.modelMaxAttempts - 1,
    abortSignal: opts.abortSignal,
  });
  return output;
}

/**
 * Blind arbiter: receives the document and the list of disputed field NAMES
 * only. It never sees what A or B read, so its vote is independent.
 */
export async function arbitrateFields(
  spec: ModelSpec,
  doc: PreparedDocument,
  fields: readonly ReceiptField[],
  opts: CallOptions,
): Promise<Partial<Receipt>> {
  const { output } = await generateText({
    model: getModel(spec, opts.config.keys),
    instructions: ARBITER_INSTRUCTIONS,
    messages: documentMessage(doc, arbiterPrompt(fields)),
    output: Output.object({ schema: partialReceiptSchema(fields) }),
    temperature: 0,
    timeout: opts.config.modelTimeoutMs,
    // A retry re-sends the whole image; on free quotas a fast failure beats burning quota.
    maxRetries: opts.config.modelMaxAttempts - 1,
    abortSignal: opts.abortSignal,
  });
  return output as Partial<Receipt>;
}
