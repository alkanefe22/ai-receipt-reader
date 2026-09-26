/** Client-safe list of bundled demo documents (the recorded responses stay server-side). */
export type DemoSample = {
  id: string;
  fileName: string;
  /** Public path of the original document. */
  file: string;
  /** Public path of a PNG preview (same as `file` for images). */
  preview: string;
  lang: "tr" | "en";
  /**
   * recorded:     real model outputs captured with `npm run record-fixture`
   * illustrative: hand-written responses for paths that live runs don't produce
   *               on demand (a crashed model, a PDF on image-only models, …)
   */
  source: "recorded" | "illustrative";
  scenario:
    | "all_agreed"
    | "arbiter_resolves"
    | "arbiter_fixes_name"
    | "shifted_line"
    | "invented_value"
    | "needs_review"
    | "validation_catch"
    | "extractor_failed";
};

export const DEMO_SAMPLES: DemoSample[] = [
  // Real recordings (Ollama: qwen3.5:9b / gemma3:12b / qwen3.5:9b)
  { id: "tr-market", fileName: "kuzey-market.png", file: "/samples/tr-market.png", preview: "/samples/tr-market.png", lang: "tr", source: "recorded", scenario: "arbiter_fixes_name" },
  { id: "tr-restaurant", fileName: "deniz-kizi.png", file: "/samples/tr-restaurant.png", preview: "/samples/tr-restaurant.png", lang: "tr", source: "recorded", scenario: "shifted_line" },
  { id: "en-coffee", fileName: "harbor-bean.png", file: "/samples/en-coffee.png", preview: "/samples/en-coffee.png", lang: "en", source: "recorded", scenario: "all_agreed" },
  { id: "tr-kirtasiye", fileName: "kalem-kutusu.png", file: "/samples/tr-kirtasiye.png", preview: "/samples/tr-kirtasiye.png", lang: "tr", source: "recorded", scenario: "invented_value" },
  { id: "tr-cafe", fileName: "kahve-duragi.png", file: "/samples/tr-cafe.png", preview: "/samples/tr-cafe.png", lang: "tr", source: "recorded", scenario: "arbiter_resolves" },
  // Illustrative scenarios
  { id: "en-invoice", fileName: "northwind-invoice.pdf", file: "/samples/en-invoice.pdf", preview: "/samples/en-invoice.png", lang: "en", source: "illustrative", scenario: "needs_review" },
  { id: "tr-kirtasiye-fallback", fileName: "kalem-kutusu-fallback.png", file: "/samples/tr-kirtasiye.png", preview: "/samples/tr-kirtasiye.png", lang: "tr", source: "illustrative", scenario: "extractor_failed" },
  { id: "tr-cafe-shared-misread", fileName: "kahve-duragi-shared-misread.png", file: "/samples/tr-cafe.png", preview: "/samples/tr-cafe.png", lang: "tr", source: "illustrative", scenario: "validation_catch" },
];
