# AI Receipt & Invoice Reader

> Two vision models read every receipt, a **blind** third model breaks ties, and a human only reviews what the machines could not agree on.

Upload receipt or invoice photos (or single-page PDFs). You get structured data (merchant, date, currency, subtotal, tax, total and line items) with a **per-field confidence status**, and you can export it to Excel or CSV. Turkish and English documents are supported.

Built with Next.js (App Router), TypeScript, Tailwind CSS and the Vercel AI SDK. Deployable to Vercel as-is. It runs in a free **demo mode** when no API keys are configured.

**Live demo:** https://ai-receipt-reader-mu.vercel.app — runs in demo mode (recorded model responses, no API calls, uploads disabled).

![Results overview in demo mode: six sample documents with per-document status](docs/screenshots/overview.png)

| Field-level review | Totals check |
| --- | --- |
| ![Invoice whose date was read three different ways, with A, B and arbiter candidates](docs/screenshots/review.png) | ![Both models made the same misread; consensus agrees but the totals check flags it](docs/screenshots/validation.png) |
| **Needs review:** A, B and the blind arbiter read the ambiguous `01/09/2026` three different ways. Every reading is one click away. | **Validation:** both models misread a smudged 54 as 45. Consensus can't see it, the arithmetic check can. |

| Real recording | Fallback reading |
| --- | --- |
| ![A real recording: model A misread the merchant name, B and the blind arbiter read it correctly](docs/screenshots/recorded.png) | ![Extractor B failed, so the arbiter model read in its place and the result is flagged as not a 2-of-3 consensus](docs/screenshots/fallback.png) |
| **Real recording:** qwen read "KUZAY", while gemma and the blind arbiter read "KUZEY". The panel names the models and the recording date. | **Fallback:** extractor B failed, so the arbiter model read the document in its place. The result is explicitly marked as not a 2-of-3 consensus. |


<sub>Screenshots are from demo mode (stored responses) and are regenerated as described in [docs/screenshots](docs/screenshots/README.md).</sub>

---

## Why two models and an arbiter?

Asking one model is fast, but you can't tell *which* fields it got wrong. This project treats extraction as a **voting problem**:

1. **Two independent readers.** Every document goes to two different vision models in parallel (Claude and Gemini by default). Both must answer with the same JSON schema.
2. **Field-by-field comparison.** Values are normalised before comparison: numbers get a tolerance, text is Turkish-aware and accent-insensitive, and dates and currencies are converted to ISO codes. Only real disagreements count.
3. **A blind arbiter, only where needed.** Disputed fields go to a third model call. The arbiter gets the image and the **names** of the disputed fields, but never the values A or B read. Its independent reading decides the field by **2-of-3 majority**.
4. **Humans for the rest.** If all three readings differ, the field is marked **needs review** and the UI asks the user to fix it, with every candidate reading one click away.
5. **Arithmetic as a final check.** Line items + tax must add up to the total. This catches errors that consensus can't, such as when both models misread the same smudged digit.

| Status | Meaning |
| --- | --- |
| 🟢 **agreed** | Both extractors read the same value (after normalisation) |
| 🔵 **arbitrated** | They disagreed; the blind arbiter matched one of them (2 of 3) |
| 🩵 **agreed (fallback)** | An extractor failed; the remaining model and the arbiter model (reading in its place) agree. Only two readers and no third vote, so this is **not** a 2-of-3 consensus |
| 🟠 **needs review** | No majority, so a human decides |
| 🟣 **edited** | Corrected by the user |

## Architecture

```mermaid
flowchart LR
    U["Upload<br/>JPG · PNG · WebP · PDF"] --> P["prepareDocument<br/>magic-byte check<br/>PDF → first page"]
    P --> A["Extractor A<br/><code>EXTRACTOR_A_MODEL</code>"]
    P --> B["Extractor B<br/><code>EXTRACTOR_B_MODEL</code>"]
    A --> C{"Compare field by field<br/>(normalised)"}
    B --> C
    C -- "equal" --> AG(["agreed"])
    C -- "disputed fields only" --> H["Blind arbiter<br/><code>ARBITER_MODEL</code><br/>image + field names"]
    H --> V{"Arbiter value matches<br/>A or B?"}
    V -- "yes" --> AR(["arbitrated · 2/3"])
    V -- "no" --> NR(["needs review"])
    AG --> T["Totals validation<br/>Σ items (+ tax) = total"]
    AR --> T
    NR --> T
    T --> UI["Review UI<br/>edit · pick candidate"]
    UI --> X["XLSX / CSV export"]
```

Line items cannot be compared by index: models skip, merge or reorder lines. So lines are first **clustered** by name similarity, with a bonus when the amounts match. The vote then happens inside each cluster:

```mermaid
flowchart LR
    LA["A's lines"] --> CL["Cluster by name similarity<br/>+ amount match"]
    LB["B's lines"] --> CL
    LR["Arbiter's lines<br/>(only if disputed)"] --> CL
    CL --> Q{"Seen by ≥ 2 readers?"}
    Q -- "no" --> D["Discarded (outvoted 2:1),<br/>listed in the UI"]
    Q -- "yes" --> F["Vote per field:<br/>name · qty · unit_price · amount"]
```

### Request lifecycle

```mermaid
sequenceDiagram
    participant UI as Browser
    participant API as POST /api/extract
    participant A as Extractor A
    participant B as Extractor B
    participant H as Arbiter
    UI->>UI: resize large photos (≤1600px)
    UI->>API: multipart file
    API->>API: rate limit · size · magic bytes · PDF page 1
    par in parallel
        API->>A: image + schema
        API->>B: image + schema
    end
    API->>API: findDisputes(A, B)
    opt only if something is disputed
        API->>H: image + disputed field NAMES
    end
    API->>API: 2/3 vote · totals validation
    API-->>UI: values + status per field + all candidate readings
```

## Design notes

**The arbiter is blind on purpose.** If the arbiter could see A's and B's answers, it would tend to pick one of them instead of reading the document itself. That anchoring would turn the "third opinion" into a tie-breaker that only restates what it was shown. Sending only the field names keeps its vote independent, so a match with A or B is real evidence.

**Correlation risk: the default arbiter shares a family with extractor A.** By default A and the arbiter are both Claude models. Models from the same family often fail the same way: same training data, same tokenizer, similar vision encoder. A shared blind spot can therefore produce a false 2/3 majority for A's mistake. This default was chosen for reading quality, but the trade-off should be visible. You can change it in `.env` without touching code:

```bash
ARBITER_PROVIDER=google          # or anthropic
ARBITER_MODEL=<a model id>       # e.g. a different Gemini tier, or a third vendor once added
```

Using a different model or provider for the arbiter than for A and B reduces the correlation. Adding a third provider only requires another `case` in `lib/providers/index.ts`.

**Single-provider setups weaken the vote further.** Every role can use the same provider, e.g. a Gemini-only setup with one free key. The pipeline works exactly the same, but then all three readers share one vendor's training data, vision stack and failure modes. Agreement between them is weaker evidence, and a 2/3 majority can simply be a shared mistake repeated. If you must stay on one provider, at least pin **three different model versions/tiers** (for example two Flash generations and a Flash-Lite) rather than one model three times. Treat *agreed* and *arbitrated* as less certain than in a mixed-vendor setup. The totals check becomes more important in this case, because it is the only signal that doesn't depend on the models agreeing.

Single-provider setups have a practical downside too: one vendor's capacity problems hit every role at once. In live testing on a free Gemini key, 503 "high demand" errors and quota limits caused extractor failures (handled by the fallback path below) and sometimes both extractors failed on the same document.

**Graceful degradation.**

- The arbiter times out → disputed fields become *needs review*.
- One extractor fails → the arbiter model reads the whole document in its place. The result is explicitly flagged as a **fallback reading** and is never shown as normal consensus:
  - matching fields get their own *agreed (fallback)* status (dashed teal), not *agreed*;
  - the substitute's values are labelled "Arbiter", not as the failed model;
  - a banner in the detail view explains that no blind third vote was possible;
  - the exported status column carries a "fallback reading" note.

  Everything the two readings disagree on is *needs review*.
- Both extractors fail → the request fails with a clear error.

**Tolerances.**

- Numbers: equal if `|a − b| ≤ max(0.01, 0.1 %)`. Printed money is exact, so a looser band would accept real misreads such as `1000` vs `1004`.
- Text: equal only if the **normalised forms are identical**. Normalisation is Turkish-aware lower-casing (`İ/ı`), accent folding (`ş → s`), and removal of punctuation and legal suffixes (`A.Ş.`, `Ltd. Şti.`, `Inc.`). A fuzzy threshold (similarity ≥ 0.9) is used only to *pair up line items*, never to decide that two values agree. In live testing a fuzzy vote let "Kahve Duracı" silently win over the correct "Kahve Durağı"; with exact matching that disagreement goes to the arbiter.
- Totals: may differ by one cent per line to absorb rounding.

**VAT-inclusive receipts.** Turkish receipts usually print prices *KDV dahil* (tax included). The validator therefore accepts either `Σitems + tax = total` (tax-exclusive) or `Σitems = total` (tax-inclusive), and reports which one it found. Discounts (`İNDİRİM`) are negative line items.

**No model IDs in code.** Providers and model IDs come only from environment variables (`EXTRACTOR_A_*`, `EXTRACTOR_B_*`, `ARBITER_*`), so you can swap models without a code change.

## Privacy

- In live mode, uploaded files are **processed in memory and never written to disk, a database or blob storage**. The API response is marked `Cache-Control: no-store`.
- The document is sent to the configured model providers (Anthropic, Google) for extraction. Their API data policies apply. Review them before processing sensitive documents.
- Server logs contain provider error messages only, never document contents.
- Results live in the browser tab until you export or close it.

## Demo mode

Without models configured (or with `DEMO_MODE=true`), the app replays **stored model responses** for eight bundled sample documents. The responses still go through the real consensus, arbitration and validation code, so the demo shows the actual pipeline at zero cost. Uploads are disabled in this mode. The sample documents are generated by `scripts/generate-samples.mjs`, and every business in them is fictional.

**Real model recordings.** Five samples replay genuine outputs, recorded on 2026-09-26 with local Ollama models: A `qwen3.5:9b`, B `gemma3:12b`, arbiter `qwen3.5:9b`. Every mistake in them is a real model mistake, and the final values match what is printed on each document.

| Sample | What actually happened |
| --- | --- |
| `tr-market` | A misread the name as "KUZAY" and skipped the discount line. B and the blind arbiter read "KUZEY" and saw the discount, so both were fixed by 2/3 |
| `tr-restaurant` | A paired a quantity line with the wrong item (KÜNEFE 60 instead of 140), and the arbiter fixed the amount. The quantity was read three ways, so it stays *needs review*. The arbiter listed quantity lines as items; the 2:1 vote dropped them |
| `en-coffee` | Both models agreed on everything |
| `tr-kirtasiye` | A **invented** a subtotal that is not printed (178.42). B and the arbiter said "not printed", so it was voted out |
| `tr-cafe` | A shifted a line and read 54 instead of 185. B and the arbiter read 185 |

**Scenario examples (hand-written).** Three paths don't happen on demand in a live run, so their responses were written by hand to show them deterministically:

| Sample | Scenario |
| --- | --- |
| `en-invoice` (2-page **PDF**) | The ambiguous `01/09/2026` is read three different ways → *needs review*. Only page 1 is processed. Local Ollama models cannot read PDFs, so this one could not be recorded |
| `tr-kirtasiye-fallback` | Extractor B fails with a 503. The arbiter model reads in its place → *agreed (fallback)*, plus one line *needs review* |
| `tr-cafe-shared-misread` | Both models make the **same** misread (54 → 45). Consensus can't see it; the totals check does |

The detail panel always says which kind you are looking at: it shows the recording's models and date, or "hand-written example responses". To record your own fixtures with whatever models are configured:

```bash
npm run record-fixture -- public/samples/tr-market.png tr-market
```

## Getting started

**Requirements:** Node.js 22+ (Node 24 LTS recommended) and npm.

```bash
git clone <your-fork-url> ai-receipt-reader
cd ai-receipt-reader
npm install
cp .env.example .env.local   # leave keys empty for demo mode
npm run dev                  # http://localhost:3000
```

To go live, fill in `.env.local`. Each role picks its own provider, and only the providers you actually use need a key. For example, all three roles can run on Gemini with a single Google key (see the note on independence below).

```bash
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

EXTRACTOR_A_PROVIDER=anthropic
EXTRACTOR_A_MODEL=<claude model id>
EXTRACTOR_B_PROVIDER=google
EXTRACTOR_B_MODEL=<gemini model id>
ARBITER_PROVIDER=anthropic
ARBITER_MODEL=<model id>
```

All settings are in [`.env.example`](.env.example), including rate limits, maximum file size, per-call timeout and optional Upstash Redis.

**Local models (Ollama).** Any role can run on a local [Ollama](https://ollama.com) server: set `*_PROVIDER=ollama` and `*_MODEL` to a **vision** model you have pulled. No API key is needed, and `OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434/api` (the native API, not the OpenAI-compatible `/v1`). Things to know:

- Ollama's chat API accepts images only, and the provider would silently drop a PDF. To prevent that, PDF uploads are rejected with a clear error whenever any role uses Ollama. Upload JPG/PNG instead.
- Local models are slower than hosted ones, so raise `MODEL_TIMEOUT_SECONDS` if calls time out.
- Structured output uses Ollama's JSON-schema `format`. Small models may still return incomplete JSON; failed calls fall through the normal fallback / needs-review paths.
- Privacy bonus: with all three roles on Ollama, documents never leave your machine.
- Verified against a local Ollama 0.34 server on an RTX 5080. The native `/api/chat` endpoint is used, with images sent as base64. The provider's default "responses" path cannot read AI SDK v7 file parts. `llama3.2-vision` (mllama) no longer loads on Ollama 0.34.
- **Latest full run:** A `qwen3.5:9b`, B `gemma3:12b`, arbiter `qwen3.5:9b`. It covered 20 documents: 5 samples plus JPEG, WebP, 45 % resolution, 6° rotation and grey/blurred variants of three of them. Results: 127/140 fields correct, 11/20 documents fully correct, and **0 silent errors**. Every wrong value was either marked *needs review* or caught by the totals check. Documents took ~25–50 s each. Also verified in the same run: 10/10 API error paths, 6/6 demo replays, and 30/30 UI checks (upload, editing, candidate picking, XLSX/CSV contents, language, mobile layout).
- **What that test showed about correlation.** With one model in all three roles, the vote is not independent, and it showed. On one receipt, B misaligned the quantity lines and the arbiter (the same model) repeated exactly that mistake, so the 2/3 majority picked the *wrong* value. On another, all three readers made the same error. In both cases the **totals check** was what flagged the document. The run also improved the prompt: a rule describing the Turkish receipt layout (the quantity line sits *above* its item) fixed most of the misalignments.

**Retries.** `MODEL_MAX_ATTEMPTS` sets the total number of attempts per model call, including the first one. The default is **1, i.e. no retry**. Every retry re-sends the whole image, and in testing a failing call with retries took up to ~65 s and burned free-tier quota quickly. A failed extractor is still covered by the fallback path, and a failed arbiter leaves its fields as *needs review*. With a paid key you can raise it (e.g. `MODEL_MAX_ATTEMPTS=3`) to ride out transient 503s.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Vitest suite: normalisation, consensus, line-item clustering, validation, PDF handling, rate limiting, API route, exports |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run generate-samples` | Re-render the demo documents in `public/samples/` |
| `npm run record-fixture -- <file> <id>` | Record live model outputs as a demo fixture |

## Deploying to Vercel

1. Import the repository in Vercel. The framework (Next.js) is detected automatically.
2. Add the environment variables from `.env.example` in **Project → Settings → Environment Variables**. Leave the keys empty for a public, cost-free demo deployment.
3. **Rate limiting:** the default limiter is in-memory, i.e. per function instance. That's fine for a demo, but serverless instances don't share counters. For a real shared limit, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (e.g. Upstash Redis from the Vercel Marketplace). The limiter switches over automatically and needs no extra dependency.

## Project structure

```
app/
  api/extract/route.ts   POST endpoint: validation, rate limit, pipeline, response
  page.tsx               server component: reads config, passes safe facts to the client
components/              ReaderApp (queue/state), ResultsTable, ReceiptDetail, ExportBar, …
lib/
  schema.ts              Zod schema, the single source of truth for every model
  config.ts              env parsing, live/demo detection
  document.ts            magic-byte sniffing, PDF first-page extraction (pdf-lib)
  pipeline.ts            A ‖ B → disputes → blind arbiter → vote → validation
  consensus/             normalize · compare · lineItems · consensus · validate (pure, tested)
  providers/             env → AI SDK model; extraction and blind arbitration calls
  prompts/               shared reading rules for all three readers
  demo/                  sample list + recorded responses + replay readers
  export/                table model → CSV (RFC 4180, BOM) and XLSX (exceljs, coloured)
  i18n/                  TR / EN dictionaries
  rateLimit.ts           fixed-window limiter (memory or Upstash REST)
scripts/                 sample generator, fixture recorder
tests/                   Vitest suites
```

## Limitations & roadmap

- Only the first page of a PDF is read in v1. Multi-page invoices are on the roadmap.
- HEIC photos are passed through unresized when the browser can't decode them. Converting them server-side is on the roadmap.
- There is no currency conversion or multi-receipt aggregation.
- A third provider (e.g. OpenAI) would make it possible to run three fully independent model families.
- Confidence calibration per field type (e.g. learning which fields each model tends to get wrong) is not implemented.

## License

[MIT](LICENSE)

---

<details>
<summary><strong>Türkçe özet</strong></summary>

**AI Fiş & Fatura Okuyucu**, fiş ve fatura görsellerinden (veya tek sayfalık PDF'lerden) işletme, tarih, para birimi, ara toplam, KDV, toplam ve kalem bilgilerini çıkarır. Sonuçları Excel veya CSV olarak dışa aktarabilirsiniz.

- Her belge iki farklı görü modeline (varsayılan olarak Claude ve Gemini) paralel gönderilir. İki model de aynı JSON şemasıyla cevap verir.
- Alanlar normalize edilerek tek tek karşılaştırılır: sayılar toleransla, metinler Türkçe harf duyarlı biçimde, tarih ve para birimi ISO formatına çevrilerek.
- Uyuşmayan alanlar **kör bir hakeme** gider. Hakem A ve B'nin okuduğu değerleri görmez; yalnızca görseli ve okuması gereken alanların adlarını alır. Hakemin okuduğu değer A veya B ile eşleşirse alan 3'te 2 çoğunlukla kabul edilir.
- Üç okuma da farklıysa alan **"kontrol gerekli"** olarak işaretlenir ve arayüzde elle düzeltilir.
- **Toplam doğrulaması** hem KDV dahil hem KDV hariç fişleri destekler. İki modelin aynı hatayı yaptığı durumları da yakalar.
- **Demo modu:** API anahtarı yoksa kayıtlı cevaplar gerçek konsensüs hattından geçirilir. Maliyet oluşmaz.
- **Gizlilik:** yüklenen dosyalar yalnızca bellekte işlenir, sunucuda saklanmaz.
- **Tasarım notu:** varsayılan hakem A ile aynı aileden (Claude). Aynı ailedeki modeller benzer hatalar yapabildiği için bu tercih korelasyon riski taşır. Hakem `ARBITER_PROVIDER` ve `ARBITER_MODEL` ile `.env` dosyasından değiştirilebilir.
- **Tek sağlayıcı notu:** üç rol de aynı sağlayıcıdan seçilebilir (örneğin tek bir ücretsiz anahtarla yalnızca Gemini). Ancak bu durumda okuyucular aynı eğitim verisini ve aynı hata eğilimlerini paylaşır. Oylamanın bağımsızlığı zayıflar ve 3'te 2 çoğunluk ortak bir hatanın tekrarı olabilir. En azından üç farklı model sürümü/seviyesi seçin ve toplam kontrolüne daha fazla güvenin.

</details>
