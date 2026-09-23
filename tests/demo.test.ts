import { describe, expect, it } from "vitest";
import { DEMO_SAMPLES, demoReaders, getFixture } from "@/lib/demo";
import { runPipeline } from "@/lib/pipeline";

/** Each bundled sample must keep demonstrating the scenario it was built for. */
async function run(id: string) {
  const fixture = getFixture(id);
  if (!fixture) throw new Error(`missing fixture ${id}`);
  return runPipeline(demoReaders(fixture));
}

describe("demo fixtures", () => {
  it("has a fixture for every sample", () => {
    for (const s of DEMO_SAMPLES) expect(getFixture(s.id), s.id).toBeDefined();
  });

  it("tr-market: everything agreed, VAT-inclusive", async () => {
    const r = await run("tr-market");
    expect(r.consensus.disputed).toEqual([]);
    expect(r.validation).toMatchObject({ ok: true, taxMode: "inclusive" });
  });

  it("tr-restaurant: arbiter sides with A on total and date", async () => {
    const r = await run("tr-restaurant");
    expect(r.consensus.disputed).toEqual(["date", "total"]);
    expect(r.consensus.fields.total).toMatchObject({ value: 955, status: "arbitrated" });
    expect(r.consensus.fields.date).toMatchObject({ value: "2026-09-19", status: "arbitrated" });
    expect(r.validation.ok).toBe(true);
  });

  it("en-coffee: line only A and arbiter saw is kept", async () => {
    const r = await run("en-coffee");
    expect(r.consensus.disputed).toEqual(["line_items"]);
    expect(r.consensus.line_items.items).toHaveLength(4);
    expect(r.consensus.line_items.status).toBe("arbitrated");
    expect(r.validation).toMatchObject({ ok: true, taxMode: "exclusive" });
  });

  it("en-invoice: date read three ways needs review", async () => {
    const r = await run("en-invoice");
    expect(r.consensus.fields.date.status).toBe("needs_review");
    expect(r.consensus.line_items.status).toBe("arbitrated");
  });

  it("tr-cafe: shared misread is agreed but validation flags it", async () => {
    const r = await run("tr-cafe");
    expect(r.consensus.disputed).toEqual([]);
    expect(r.validation.ok).toBe(false);
    expect(r.validation.warnings[0]).toMatchObject({ code: "items_total_mismatch", itemsSum: 380, total: 389 });
  });
});

describe("runPipeline failure handling", () => {
  const fixture = getFixture("tr-restaurant")!;

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
    expect(r.consensus.fields.total.status).toBe("needs_review");
  });
});
