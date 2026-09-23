import { describe, expect, it } from "vitest";
import type { ExtractSuccess } from "@/lib/api-types";
import { addLineItem, editField, editLineItem, removeLineItem } from "@/lib/client/edit";
import { resolveConsensus } from "@/lib/consensus/consensus";
import { validateReceipt } from "@/lib/consensus/validate";
import { countNeedingReview, documentStatus } from "@/lib/status";
import { receipt } from "./consensus/fixtures";

function result(): ExtractSuccess {
  const consensus = resolveConsensus(receipt(), receipt({ total: 156 }), { total: 999 });
  return {
    id: "1",
    fileName: "x.png",
    mediaType: "image/png",
    source: "replay",
    models: null,
    notices: [],
    timings: { extractMs: 0, arbiterMs: 0, totalMs: 0 },
    consensus,
    validation: validateReceipt(receipt()),
  };
}

describe("client edits", () => {
  it("resolves a needs_review field and revalidates", () => {
    const r0 = result();
    expect(documentStatus(r0.consensus)).toBe("needs_review");
    const r1 = editField(r0, "total", 200);
    expect(r1.consensus.fields.total).toMatchObject({ value: 200, edited: true, status: "needs_review" });
    expect(countNeedingReview(r1.consensus)).toBe(0);
    expect(r1.validation.ok).toBe(false); // 150 + 15 ≠ 200
    expect(r0.consensus.fields.total.edited).toBeUndefined(); // immutable
  });

  it("edits, adds and removes line items", () => {
    let r = editLineItem(result(), 0, "amount", 25);
    expect(r.consensus.line_items.items[0].amount.value).toBe(25);
    r = addLineItem(r);
    expect(r.consensus.line_items.items).toHaveLength(4);
    expect(r.consensus.line_items.items[3].name.value).toBe("");
    r = removeLineItem(r, 3);
    expect(r.consensus.line_items.items).toHaveLength(3);
  });
});
