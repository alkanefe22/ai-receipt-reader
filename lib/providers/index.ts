import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";
import type { AppConfig, ModelSpec } from "@/lib/config";

/** Resolves an env-configured model spec to an AI SDK model. No model IDs live in code. */
export function getModel(spec: ModelSpec, config: Pick<AppConfig, "keys" | "ollamaBaseUrl">): LanguageModel {
  const { keys } = config;
  switch (spec.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: keys.anthropic })(spec.model);
    case "google":
      return createGoogle({ apiKey: keys.google })(spec.model);
    case "ollama":
      // .chat() = Ollama's native /api/chat. The provider's default (responses) path
      // cannot read AI SDK v7 file parts and throws before sending the request.
      return createOllama({ baseURL: config.ollamaBaseUrl }).chat(spec.model);
  }
}

/**
 * Ollama's chat API accepts images only; the provider silently drops PDF
 * parts, so the model would answer without ever seeing the document.
 */
export const supportsPdf = (spec: ModelSpec) => spec.provider !== "ollama";

/** Human-readable label for the UI, e.g. "anthropic/claude-…". */
export const modelLabel = (spec: ModelSpec) => `${spec.provider}/${spec.model}`;
