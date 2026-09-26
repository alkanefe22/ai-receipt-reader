import type { Readers } from "@/lib/pipeline";
import { ReceiptSchema, type Receipt, type ReceiptField } from "@/lib/schema";
import enCoffee from "./fixtures/en-coffee.json";
import enInvoice from "./fixtures/en-invoice.json";
import trCafeSharedMisread from "./fixtures/tr-cafe-shared-misread.json";
import trCafe from "./fixtures/tr-cafe.json";
import trKirtasiyeFallback from "./fixtures/tr-kirtasiye-fallback.json";
import trKirtasiye from "./fixtures/tr-kirtasiye.json";
import trMarket from "./fixtures/tr-market.json";
import trRestaurant from "./fixtures/tr-restaurant.json";
import type { ModelSpec } from "@/lib/config";

export { DEMO_SAMPLES, type DemoSample } from "./samples";

/**
 * Demo mode replays stored model responses through the real consensus
 * pipeline — no API calls, no cost. Most fixtures are real recordings made
 * with `npm run record-fixture` (they carry a `recorded` block); the rest are
 * hand-written to show paths a live run doesn't produce on demand.
 */

/**
 * A fixture may record a failed extractor: `b: null` + `bError`, with the
 * arbiter model's full `substitute` reading used in its place.
 */
export type Recording = { at: string; models: { a: ModelSpec; b: ModelSpec; arbiter: ModelSpec } };

type Fixture = {
  recorded?: Recording;
  a: Receipt;
  b: Receipt | null;
  bError?: string;
  substitute?: Receipt;
  arbiter: Partial<Receipt>;
};

const FIXTURES: Record<string, unknown> = {
  "tr-market": trMarket,
  "tr-restaurant": trRestaurant,
  "en-coffee": enCoffee,
  "en-invoice": enInvoice,
  "tr-cafe": trCafe,
  "tr-kirtasiye": trKirtasiye,
  "tr-kirtasiye-fallback": trKirtasiyeFallback,
  "tr-cafe-shared-misread": trCafeSharedMisread,
};

const PartialReceipt = ReceiptSchema.partial();

/** Fixtures are validated like live model output, so a bad edit fails loudly. */
export function getFixture(id: string): Fixture | undefined {
  const raw = FIXTURES[id] as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  return {
    recorded: raw.recorded as Recording | undefined,
    a: ReceiptSchema.parse(raw.a),
    b: raw.b == null ? null : ReceiptSchema.parse(raw.b),
    bError: typeof raw.bError === "string" ? raw.bError : undefined,
    substitute: raw.substitute == null ? undefined : ReceiptSchema.parse(raw.substitute),
    arbiter: PartialReceipt.parse(raw.arbiter),
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Readers that replay a fixture. Small delays keep the UI's progress states visible. */
export function demoReaders(fixture: Fixture, latencyMs = 0): Readers {
  return {
    extractA: async () => (await delay(latencyMs), fixture.a),
    extractB: async () => {
      await delay(latencyMs * 1.2);
      if (!fixture.b) throw new Error(fixture.bError ?? "extractor B failed");
      return fixture.b;
    },
    arbitrate: async (fields: ReceiptField[]) => {
      await delay(latencyMs * 0.8);
      // The recorded arbiter answer is filtered to exactly the requested fields.
      return Object.fromEntries(fields.filter((f) => f in fixture.arbiter).map((f) => [f, fixture.arbiter[f]]));
    },
    ...(fixture.substitute && {
      substitute: async () => (await delay(latencyMs), fixture.substitute!),
    }),
  };
}
