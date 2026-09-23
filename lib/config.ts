import "server-only";
import { z } from "zod";

export const PROVIDERS = ["anthropic", "google"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export type ModelSpec = { provider: ProviderName; model: string };

export type AppConfig = {
  mode: "live" | "demo";
  /** Why demo mode is active, when it is. */
  demoReason?: "forced" | "missing-keys" | "missing-models";
  keys: { anthropic?: string; google?: string };
  extractorA?: ModelSpec;
  extractorB?: ModelSpec;
  arbiter?: ModelSpec;
  rateLimit: { max: number; windowSeconds: number };
  maxFileBytes: number;
  modelTimeoutMs: number;
  upstash?: { url: string; token: string };
};

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().catch(fallback);

const EnvSchema = z.object({
  DEMO_MODE: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  EXTRACTOR_A_PROVIDER: optionalString,
  EXTRACTOR_A_MODEL: optionalString,
  EXTRACTOR_B_PROVIDER: optionalString,
  EXTRACTOR_B_MODEL: optionalString,
  ARBITER_PROVIDER: optionalString,
  ARBITER_MODEL: optionalString,
  RATE_LIMIT_MAX: positiveInt(10),
  RATE_LIMIT_WINDOW_SECONDS: positiveInt(3600),
  MAX_FILE_MB: positiveInt(10),
  MODEL_TIMEOUT_SECONDS: positiveInt(60),
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
});

function modelSpec(provider?: string, model?: string): ModelSpec | undefined {
  if (!provider || !model) return undefined;
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(
      `Unknown provider "${provider}". Expected one of: ${PROVIDERS.join(", ")}`,
    );
  }
  return { provider: provider as ProviderName, model };
}

/** Pure config builder — takes an env record so it can be unit-tested. */
export function buildConfig(env: Record<string, string | undefined>): AppConfig {
  const e = EnvSchema.parse(env);

  const keys = { anthropic: e.ANTHROPIC_API_KEY, google: e.GOOGLE_GENERATIVE_AI_API_KEY };
  const extractorA = modelSpec(e.EXTRACTOR_A_PROVIDER, e.EXTRACTOR_A_MODEL);
  const extractorB = modelSpec(e.EXTRACTOR_B_PROVIDER, e.EXTRACTOR_B_MODEL);
  const arbiter = modelSpec(e.ARBITER_PROVIDER, e.ARBITER_MODEL);

  const specs = [extractorA, extractorB, arbiter];
  const hasAllModels = specs.every(Boolean);
  const hasAllKeys = specs.every((s) => !s || Boolean(keys[s.provider]));

  let demoReason: AppConfig["demoReason"];
  if (e.DEMO_MODE?.toLowerCase() === "true") demoReason = "forced";
  else if (!hasAllModels) demoReason = "missing-models";
  else if (!hasAllKeys) demoReason = "missing-keys";

  return {
    mode: demoReason ? "demo" : "live",
    demoReason,
    keys,
    extractorA,
    extractorB,
    arbiter,
    rateLimit: { max: e.RATE_LIMIT_MAX, windowSeconds: e.RATE_LIMIT_WINDOW_SECONDS },
    maxFileBytes: e.MAX_FILE_MB * 1024 * 1024,
    modelTimeoutMs: e.MODEL_TIMEOUT_SECONDS * 1000,
    upstash:
      e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN
        ? { url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN }
        : undefined,
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= buildConfig(process.env);
  return cached;
}
