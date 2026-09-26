import { describe, expect, it, vi } from "vitest";

// No keys in the test env → the app runs in demo mode.
vi.stubEnv("ANTHROPIC_API_KEY", "");
vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

const { POST } = await import("@/app/api/extract/route");

function post(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return POST(new Request("http://localhost/api/extract", { method: "POST", body: form }));
}

describe("POST /api/extract (demo mode)", () => {
  it("replays a bundled sample through the consensus pipeline", async () => {
    const res = await post({ sampleId: "tr-restaurant" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("replay");
    // A real recording: replayed, but it names the models that produced it.
    expect(body.models).toEqual({ a: "ollama/qwen3.5:9b", b: "ollama/gemma3:12b", arbiter: "ollama/qwen3.5:9b" });
    expect(body.recordedAt).toMatch(/^2026-/);
    expect(body.consensus.line_items.items[3].amount.status).toBe("arbitrated");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  }, 10_000);

  it("does not attribute illustrative samples to any model", async () => {
    const body = await (await post({ sampleId: "en-invoice" })).json();
    expect(body.models).toBeNull();
    expect(body.recordedAt).toBeUndefined();
  });

  it("rejects unknown samples", async () => {
    const res = await post({ sampleId: "nope" });
    expect(res.status).toBe(404);
  });

  it("refuses live uploads without API keys", async () => {
    const res = await post({ file: new File([new Uint8Array([0xff, 0xd8, 0xff])], "r.jpg", { type: "image/jpeg" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("demo_upload_disabled");
  });

  it("rejects requests without a file or sample", async () => {
    expect((await post({})).status).toBe(400);
  });
});
