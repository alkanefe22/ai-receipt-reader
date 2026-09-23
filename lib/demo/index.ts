import type { Readers } from "@/lib/pipeline";
import { ReceiptSchema, type Receipt, type ReceiptField } from "@/lib/schema";
import enCoffee from "./fixtures/en-coffee.json";
import enInvoice from "./fixtures/en-invoice.json";
import trCafe from "./fixtures/tr-cafe.json";
import trMarket from "./fixtures/tr-market.json";
import trRestaurant from "./fixtures/tr-restaurant.json";

/**
 * Demo mode replays stored model responses through the real consensus
 * pipeline — no API calls, no cost. The bundled responses are illustrative:
 * each one is crafted to exercise a specific consensus path. Replace them with
 * real recordings via `npm run record-fixture`.
 */

export type DemoSample = {
  id: string;
  fileName: string;
  /** Public path of the original document. */
  file: string;
  /** Public path of a PNG preview (same as `file` for images). */
  preview: string;
  lang: "tr" | "en";
  scenario: "all_agreed" | "arbiter_resolves" | "missing_line" | "needs_review" | "validation_catch";
};

type Fixture = { a: Receipt; b: Receipt; arbiter: Partial<Receipt> };

export const DEMO_SAMPLES: DemoSample[] = [
  { id: "tr-market", fileName: "kuzey-market.png", file: "/samples/tr-market.png", preview: "/samples/tr-market.png", lang: "tr", scenario: "all_agreed" },
  { id: "tr-restaurant", fileName: "deniz-kizi.png", file: "/samples/tr-restaurant.png", preview: "/samples/tr-restaurant.png", lang: "tr", scenario: "arbiter_resolves" },
  { id: "en-coffee", fileName: "harbor-bean.png", file: "/samples/en-coffee.png", preview: "/samples/en-coffee.png", lang: "en", scenario: "missing_line" },
  { id: "en-invoice", fileName: "northwind-invoice.pdf", file: "/samples/en-invoice.pdf", preview: "/samples/en-invoice.png", lang: "en", scenario: "needs_review" },
  { id: "tr-cafe", fileName: "kahve-duragi.png", file: "/samples/tr-cafe.png", preview: "/samples/tr-cafe.png", lang: "tr", scenario: "validation_catch" },
];

const FIXTURES: Record<string, unknown> = {
  "tr-market": trMarket,
  "tr-restaurant": trRestaurant,
  "en-coffee": enCoffee,
  "en-invoice": enInvoice,
  "tr-cafe": trCafe,
};

const PartialReceipt = ReceiptSchema.partial();

/** Fixtures are validated like live model output, so a bad edit fails loudly. */
export function getFixture(id: string): Fixture | undefined {
  const raw = FIXTURES[id] as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  return {
    a: ReceiptSchema.parse(raw.a),
    b: ReceiptSchema.parse(raw.b),
    arbiter: PartialReceipt.parse(raw.arbiter),
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Readers that replay a fixture. Small delays keep the UI's progress states visible. */
export function demoReaders(fixture: Fixture, latencyMs = 0): Readers {
  return {
    extractA: async () => (await delay(latencyMs), fixture.a),
    extractB: async () => (await delay(latencyMs * 1.2), fixture.b),
    arbitrate: async (fields: ReceiptField[]) => {
      await delay(latencyMs * 0.8);
      // The recorded arbiter answer is filtered to exactly the requested fields.
      return Object.fromEntries(fields.filter((f) => f in fixture.arbiter).map((f) => [f, fixture.arbiter[f]]));
    },
  };
}
