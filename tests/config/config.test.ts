import { describe, expect, it } from "vitest";
import { buildConfig } from "@/lib/config";

const LIVE_ENV = {
  ANTHROPIC_API_KEY: "sk-a",
  GOOGLE_GENERATIVE_AI_API_KEY: "g-key",
  EXTRACTOR_A_PROVIDER: "anthropic",
  EXTRACTOR_A_MODEL: "model-a",
  EXTRACTOR_B_PROVIDER: "google",
  EXTRACTOR_B_MODEL: "model-b",
  ARBITER_PROVIDER: "anthropic",
  ARBITER_MODEL: "model-c",
};

describe("buildConfig", () => {
  it("falls back to demo mode with an empty env", () => {
    const c = buildConfig({});
    expect(c.mode).toBe("demo");
    expect(c.demoReason).toBe("missing-models");
  });

  it("is live when all models and keys are present", () => {
    const c = buildConfig(LIVE_ENV);
    expect(c.mode).toBe("live");
    expect(c.arbiter).toEqual({ provider: "anthropic", model: "model-c" });
  });

  it("is demo when a required key is missing", () => {
    const c = buildConfig({ ...LIVE_ENV, GOOGLE_GENERATIVE_AI_API_KEY: "" });
    expect(c.mode).toBe("demo");
    expect(c.demoReason).toBe("missing-keys");
  });

  it("runs live with all three roles on Gemini and only a Google key", () => {
    const c = buildConfig({
      GOOGLE_GENERATIVE_AI_API_KEY: "g-key",
      EXTRACTOR_A_PROVIDER: "google",
      EXTRACTOR_A_MODEL: "g-1",
      EXTRACTOR_B_PROVIDER: "google",
      EXTRACTOR_B_MODEL: "g-2",
      ARBITER_PROVIDER: "google",
      ARBITER_MODEL: "g-3",
    });
    expect(c.mode).toBe("live");
    expect(c.keys.anthropic).toBeUndefined();
  });

  it("stays in demo if a role points to Anthropic without an Anthropic key", () => {
    const c = buildConfig({ ...LIVE_ENV, ANTHROPIC_API_KEY: "", EXTRACTOR_B_PROVIDER: "google" });
    expect(c.demoReason).toBe("missing-keys");
  });

  it("honours DEMO_MODE=true even with keys", () => {
    expect(buildConfig({ ...LIVE_ENV, DEMO_MODE: "true" }).demoReason).toBe("forced");
  });

  it("rejects unknown providers", () => {
    expect(() => buildConfig({ ...LIVE_ENV, ARBITER_PROVIDER: "openai" })).toThrow(/Unknown provider/);
  });

  it("defaults to a single attempt per model call and accepts overrides", () => {
    expect(buildConfig({}).modelMaxAttempts).toBe(1);
    expect(buildConfig({ MODEL_MAX_ATTEMPTS: "3" }).modelMaxAttempts).toBe(3);
    expect(buildConfig({ MODEL_MAX_ATTEMPTS: "0" }).modelMaxAttempts).toBe(1);
  });

  it("uses defaults for invalid numeric limits", () => {
    const c = buildConfig({ RATE_LIMIT_MAX: "abc", MAX_FILE_MB: "5" });
    expect(c.rateLimit.max).toBe(10);
    expect(c.maxFileBytes).toBe(5 * 1024 * 1024);
  });
});
