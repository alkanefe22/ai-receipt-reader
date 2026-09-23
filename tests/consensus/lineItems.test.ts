import { describe, expect, it } from "vitest";
import { clusterLineItems, lineItemsDisputed, resolveLineItems } from "@/lib/consensus/lineItems";
import { item } from "./fixtures";

const A = [item("Ekmek", 2, 10, 20), item("Beyaz Peynir", 1, 100, 100), item("Ayran", 3, 10, 30)];

describe("clusterLineItems", () => {
  it("matches reordered lines by name", () => {
    const b = [A[2], A[0], A[1]];
    const clusters = clusterLineItems(A, b);
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.members.a && c.members.b)).toBe(true);
    expect(clusters[1].members.b?.name).toBe("Beyaz Peynir");
  });

  it("matches OCR-mangled names", () => {
    const b = [item("EKMEK", 2, 10, 20), item("BYZ PEYNIR", 1, 100, 100), item("AYRAN", 3, 10, 30)];
    expect(clusterLineItems(A, b).every((c) => c.members.a && c.members.b)).toBe(true);
  });

  it("keeps unmatched lines as their own clusters", () => {
    const b = [...A, item("Poşet", 1, 0.25, 0.25)];
    const clusters = clusterLineItems(A, b);
    expect(clusters).toHaveLength(4);
    expect(clusters[3].members).toEqual({ b: b[3] });
  });
});

describe("lineItemsDisputed", () => {
  it("is false for equivalent lists", () => {
    expect(lineItemsDisputed(A, [A[1], A[0], A[2]])).toBe(false);
  });

  it("is true when a field differs", () => {
    expect(lineItemsDisputed(A, [A[0], item("Beyaz Peynir", 1, 100, 10), A[2]])).toBe(true);
  });
});

describe("resolveLineItems", () => {
  it("votes per field inside a line", () => {
    const b = [A[0], item("Beyaz Peynir", 1, 100, 10), A[2]];
    const arbiter = [item("Beyaz Peynir", 1, 100, 100)];
    const r = resolveLineItems(A, b, arbiter);
    const cheese = r.items[1];
    expect(cheese.amount).toMatchObject({ value: 100, status: "arbitrated", majority: ["a", "arbiter"] });
    expect(cheese.name.status).toBe("agreed");
    expect(r.status).toBe("arbitrated");
  });

  it("discards a line only one of three readers saw", () => {
    const b = [...A, item("Poşet", 1, 0.25, 0.25)];
    const r = resolveLineItems(A, b, A);
    expect(r.items).toHaveLength(3);
    expect(r.discarded).toEqual([{ reader: "b", item: b[3] }]);
    expect(r.status).toBe("arbitrated");
  });

  it("keeps a line two of three readers saw", () => {
    const b = A.slice(0, 2); // B missed "Ayran"
    const r = resolveLineItems(A, b, A);
    expect(r.items).toHaveLength(3);
    expect(r.items[2].seenBy).toEqual(["a", "arbiter"]);
    expect(r.items[2].amount.status).toBe("arbitrated");
  });

  it("flags lines seen by only one reader when no arbiter is available", () => {
    const r = resolveLineItems(A, A.slice(0, 2));
    expect(r.items[2].amount.status).toBe("needs_review");
    expect(r.status).toBe("needs_review");
  });

  it("needs review when all three disagree on a value", () => {
    const b = [A[0], item("Beyaz Peynir", 1, 100, 10), A[2]];
    const r = resolveLineItems(A, b, [item("Beyaz Peynir", 1, 100, 1000)]);
    expect(r.items[1].amount.status).toBe("needs_review");
  });
});
