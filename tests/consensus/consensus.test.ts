import { describe, expect, it, vi } from "vitest";
import { consensusToReceipt, findDisputes, resolveConsensus, runConsensus } from "@/lib/consensus/consensus";
import { item, receipt } from "./fixtures";

describe("findDisputes", () => {
  it("finds nothing when readings only differ cosmetically", () => {
    const b = receipt({
      merchant: "KUZEY MARKET",
      date: "07.03.2026",
      currency: "TL",
      total: 165.004,
      line_items: [item("EKMEK", 2, 10, 20), item("Beyaz Peynir", 1, 100, 100), item("AYRAN", 3, 10, 30)],
    });
    expect(findDisputes(receipt(), b)).toEqual([]);
  });

  it("lists every disagreeing field", () => {
    const b = receipt({ total: 156, date: "2026-03-08" });
    expect(findDisputes(receipt(), b)).toEqual(["date", "total"]);
  });

  it("flags line items when a line is missing", () => {
    const b = receipt({ line_items: receipt().line_items.slice(0, 2) });
    expect(findDisputes(receipt(), b)).toEqual(["line_items"]);
  });
});

describe("resolveConsensus", () => {
  it("marks everything agreed and canonicalises values", () => {
    const b = receipt({ date: "07.03.2026", currency: "₺" });
    const r = resolveConsensus(receipt({ date: "07/03/2026", currency: "TL" }), b);
    expect(r.fields.date).toMatchObject({ value: "2026-03-07", status: "agreed" });
    expect(r.fields.currency).toMatchObject({ value: "TRY", status: "agreed" });
    expect(r.line_items.status).toBe("agreed");
    expect(r.arbiterUsed).toBe(false);
  });

  it("accepts the side the blind arbiter agrees with (2/3)", () => {
    const a = receipt({ total: 165 });
    const b = receipt({ total: 156 });
    const r = resolveConsensus(a, b, { total: 165.0 });
    expect(r.fields.total).toMatchObject({ value: 165, status: "arbitrated", majority: ["a", "arbiter"] });

    const r2 = resolveConsensus(a, b, { total: 156 });
    expect(r2.fields.total).toMatchObject({ value: 156, status: "arbitrated", majority: ["b", "arbiter"] });
  });

  it("marks needs_review when all three readings differ", () => {
    const r = resolveConsensus(receipt({ total: 165 }), receipt({ total: 156 }), { total: 185 });
    expect(r.fields.total.status).toBe("needs_review");
    expect(r.fields.total.candidates).toEqual({ a: 165, b: 156, arbiter: 185 });
    expect(r.fields.total.majority).toEqual([]);
  });

  it("ignores arbiter values for fields that were not disputed", () => {
    const r = resolveConsensus(receipt(), receipt({ total: 156 }), { total: 165, merchant: "Something else" });
    expect(r.fields.merchant.status).toBe("agreed");
    expect(r.fields.merchant.candidates.arbiter).toBeUndefined();
  });

  it("treats a null arbiter reading as a vote for 'not printed'", () => {
    const r = resolveConsensus(receipt({ subtotal: null }), receipt({ subtotal: 150 }), { subtotal: null });
    expect(r.fields.subtotal).toMatchObject({ value: null, status: "arbitrated" });
  });
});

describe("runConsensus", () => {
  it("does not call the arbiter when A and B agree", async () => {
    const arbitrate = vi.fn();
    const r = await runConsensus(receipt(), receipt(), arbitrate);
    expect(arbitrate).not.toHaveBeenCalled();
    expect(r.disputed).toEqual([]);
  });

  it("asks the arbiter only for disputed fields", async () => {
    const arbitrate = vi.fn().mockResolvedValue({ total: 165, merchant: "Kuzey Market" });
    const r = await runConsensus(receipt(), receipt({ total: 156, merchant: "Guney Bakkal" }), arbitrate);
    expect(arbitrate).toHaveBeenCalledWith(["merchant", "total"]);
    expect(r.fields.total.status).toBe("arbitrated");
    expect(r.fields.merchant.status).toBe("arbitrated");
    expect(r.arbiterUsed).toBe(true);
  });

  it("degrades to needs_review when the arbiter fails", async () => {
    const arbitrate = vi.fn().mockRejectedValue(new Error("timeout"));
    const r = await runConsensus(receipt(), receipt({ total: 156 }), arbitrate);
    expect(r.fields.total.status).toBe("needs_review");
    expect(r.fields.merchant.status).toBe("agreed");
    expect(r.arbiterError).toBe("timeout");
    expect(r.arbiterUsed).toBe(false);
  });
});

describe("consensusToReceipt", () => {
  it("round-trips agreed values", () => {
    const r = resolveConsensus(receipt(), receipt());
    expect(consensusToReceipt(r)).toEqual(receipt());
  });
});
