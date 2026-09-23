/**
 * Records real model responses for a document as a demo fixture, so the demo
 * can replay genuine outputs instead of the bundled illustrative ones.
 *
 *   npm run record-fixture -- <path-to-document> <fixture-id>
 *
 * Needs live-mode config in .env.local. Makes 2–3 paid model calls.
 * Afterwards add the id to DEMO_SAMPLES in lib/demo/index.ts (if new) and
 * copy the document to public/samples/.
 */
import { readFile, writeFile } from "node:fs/promises";
import { buildConfig } from "@/lib/config";
import { findDisputes } from "@/lib/consensus/consensus";
import { prepareDocument } from "@/lib/document";
import { arbitrateFields, extractReceipt } from "@/lib/providers/extract";

const [file, id] = process.argv.slice(2);
if (!file || !id || !/^[a-z0-9-]+$/.test(id)) {
  console.error("Usage: npm run record-fixture -- <path-to-document> <fixture-id (a-z, 0-9, -)>");
  process.exit(1);
}

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to the ambient environment.
}

const config = buildConfig(process.env);
if (config.mode !== "live") {
  console.error(`Live config required (currently demo: ${config.demoReason}). Fill in .env.local first.`);
  process.exit(1);
}
const { extractorA, extractorB, arbiter } = config as Required<typeof config>;

const doc = await prepareDocument(new Uint8Array(await readFile(file)));
console.log(`Reading ${file} (${doc.mediaType}) with A and B…`);
const [a, b] = await Promise.all([
  extractReceipt(extractorA, doc, { config }),
  extractReceipt(extractorB, doc, { config }),
]);

const disputed = findDisputes(a, b);
console.log(disputed.length ? `Disputed: ${disputed.join(", ")} → asking the arbiter (blind)…` : "No disputes.");
const arbiterReading = disputed.length ? await arbitrateFields(arbiter, doc, disputed, { config }) : {};

const out = new URL(`../lib/demo/fixtures/${id}.json`, import.meta.url);
await writeFile(
  out,
  JSON.stringify(
    {
      recorded: {
        at: new Date().toISOString(),
        models: { a: extractorA, b: extractorB, arbiter },
      },
      a,
      b,
      arbiter: arbiterReading,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Saved ${out.pathname}`);
