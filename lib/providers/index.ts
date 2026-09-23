import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { AppConfig, ModelSpec } from "@/lib/config";

/** Resolves an env-configured model spec to an AI SDK model. No model IDs live in code. */
export function getModel(spec: ModelSpec, keys: AppConfig["keys"]): LanguageModel {
  switch (spec.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: keys.anthropic })(spec.model);
    case "google":
      return createGoogle({ apiKey: keys.google })(spec.model);
  }
}

/** Human-readable label for the UI, e.g. "anthropic/claude-…". */
export const modelLabel = (spec: ModelSpec) => `${spec.provider}/${spec.model}`;
