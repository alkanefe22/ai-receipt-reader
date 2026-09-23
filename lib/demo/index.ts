import type { Readers } from "@/lib/pipeline";
import { ReceiptSchema, type Receipt, type ReceiptField } from "@/lib/schema";
import enCoffee from "./fixtures/en-coffee.json";
import enInvoice from "./fixtures/en-invoice.json";
import trCafe from "./fixtures/tr-cafe.json";
import trMarket from "./fixtures/tr-market.json";
import trRestaurant from "./fixtures/tr-restaurant.json";

export { DEMO_SAMPLES, type DemoSample } from "./samples";

/**
 * Demo mode replays stored model responses through the real consensus
 * pipeline — no API calls, no cost. The bundled responses are illustrative:
 * each one is crafted to exercise a specific consensus path. Replace them with
 * real recordings via `npm run record-fixture`.
 */

type Fixture = { a: Receipt; b: Receipt; arbiter: Partial<Receipt> };

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
