import { describe, expect, it } from "vitest";
import { DEMO_SAMPLES, demoReaders, getFixture } from "@/lib/demo";
import { runPipeline } from "@/lib/pipeline";

/** Each bundled sample must keep demonstrating the scenario it was built for. */
async function run(id: string) {
  const fixture = getFixture(id);
  if (!fixture) throw new Error(`missing fixture ${id}`);
  return runPipeline(demoReaders(fixture));
}

describe("demo fixtures: real recordings", () => {
  it("has a fixture for every sample, and recorded samples carry their models", () => {
    for (const s of DEMO_SAMPLES) {
      const f = getFixture(s.id);
      expect(f, s.id).toBeDefined();
      expect(Boolean(f!.recorded), s.id).toBe(s.source === "recorded");
    }
  });

  it("tr-market: blind arbiter fixes A's misread name and keeps the line A skipped", async () => {
    const r = await run("tr-market");
    expect(r.consensus.fields.merchant).toMatchObject({ value: "KUZEY GIDA MARKET LTD. ŞTİ.", status: "arbitrated", majority: ["b", "arbiter"] });
    const discount = r.consensus.line_items.items.find((i) => i.amount.value === -15);
    expect(discount?.seenBy).toEqual(["b", "arbiter"]);
    expect(r.consensus.fields.total.value).toBe(402.03);
    expect(r.validation.ok).toBe(true);
  });

  it("tr-restaurant: shifted line — amount fixed 2/3, conflicting qty left for review", async () => {
    const r = await run("tr-restaurant");
    expect(r.consensus.line_items.items.map((i) => i.amount.value)).toEqual([170, 490, 95, 140, 60]);
    const kunefe = r.consensus.line_items.items[3];
    expect(kunefe.amount).toMatchObject({ value: 140, status: "arbitrated" });
    expect(kunefe.qty.status).toBe("needs_review");
    // The arbiter listed quantity lines as items; the 2:1 vote drops them.
    expect(r.consensus.line_items.discarded.length).toBeGreaterThan(0);
    expect(r.consensus.line_items.discarded.every((d) => d.reader === "arbiter")).toBe(true);
  });

  it("en-coffee: both models agree on everything", async () => {
    const r = await run("en-coffee");
    expect(r.consensus.disputed).toEqual([]);
    expect(r.validation).toMatchObject({ ok: true, taxMode: "exclusive" });
  });

  it("tr-kirtasiye: an invented subtotal is voted out by the blind arbiter", async () => {
    const r = await run("tr-kirtasiye");
    expect(r.consensus.fields.subtotal).toMatchObject({ value: null, status: "arbitrated", majority: ["b", "arbiter"] });
    expect(r.consensus.fields.subtotal.candidates.a).toBe(178.42);
    expect(r.consensus.line_items.items.map((i) => i.amount.value)).toEqual([135, 62.5, 16]);
    expect(r.validation.ok).toBe(true);
  });

  it("tr-cafe: arbiter fixes A's shifted amount", async () => {
    const r = await run("tr-cafe");
    const cake = r.consensus.line_items.items.find((i) => i.name.value === "SAN SEBASTIAN")!;
    expect(cake.amount).toMatchObject({ value: 185, status: "arbitrated", candidates: { a: 54, b: 185, arbiter: 185 } });
    expect(r.validation.ok).toBe(true);
  });
});

describe("demo fixtures: illustrative scenarios", () => {
  it("en-invoice: date read three ways needs review", async () => {
    const r = await run("en-invoice");
    expect(r.consensus.fields.date.status).toBe("needs_review");
    expect(r.consensus.line_items.status).toBe("arbitrated");
  });

  it("tr-cafe-shared-misread: shared misread is agreed but validation flags it", async () => {
    const r = await run("tr-cafe-shared-misread");
    expect(r.consensus.disputed).toEqual([]);
    expect(r.validation.ok).toBe(false);
    expect(r.validation.warnings[0]).toMatchObject({ code: "items_total_mismatch", itemsSum: 380, total: 389 });
  });

  it("tr-kirtasiye-fallback: B fails, arbiter substitutes, result is flagged as fallback", async () => {
    const r = await run("tr-kirtasiye-fallback");
    expect(r.consensus.fallback).toEqual({ failedReader: "b" });
    expect(r.notices[0]).toMatchObject({ code: "extractor_failed", reader: "b", substituted: true });
    expect(r.consensus.fields.total.status).toBe("fallback_agreed");
    expect(r.consensus.line_items.items[2].amount.status).toBe("needs_review");
    expect(Object.values(r.consensus.fields).some((f) => f.status === "agreed" || f.status === "arbitrated")).toBe(false);
  });
});

describe("runPipeline failure handling", () => {
  const fixture = getFixture("tr-kirtasiye")!; // real recording with a disputed subtotal

  it("substitutes a failed extractor with the arbiter model", async () => {
    const r = await runPipeline({
      ...demoReaders(fixture),
      extractB: () => Promise.reject(new Error("503")),
      substitute: async () => fixture.a,
    });
    expect(r.notices).toContainEqual({ code: "extractor_failed", reader: "b", substituted: true, error: "503" });
    expect(r.consensus.disputed).toEqual([]);
  });

  it("throws when both extractors fail", async () => {
    await expect(
      runPipeline({ ...demoReaders(fixture), extractA: () => Promise.reject(new Error("x")), extractB: () => Promise.reject(new Error("y")) }),
    ).rejects.toMatchObject({ errors: { a: "x", b: "y" } });
  });

  it("reports an arbiter failure as a notice", async () => {
    const r = await runPipeline({ ...demoReaders(fixture), arbitrate: () => Promise.reject(new Error("timeout")) });
    expect(r.notices).toContainEqual({ code: "arbiter_failed", error: "timeout" });
    expect(r.consensus.fields.subtotal.status).toBe("needs_review");
  });
});
