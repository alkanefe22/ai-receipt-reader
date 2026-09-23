/** Client-safe list of bundled demo documents (the recorded responses stay server-side). */
export type DemoSample = {
  id: string;
  fileName: string;
  /** Public path of the original document. */
  file: string;
  /** Public path of a PNG preview (same as `file` for images). */
  preview: string;
  lang: "tr" | "en";
  scenario: "all_agreed" | "arbiter_resolves" | "missing_line" | "needs_review" | "validation_catch" | "extractor_failed";
};

export const DEMO_SAMPLES: DemoSample[] = [
  { id: "tr-market", fileName: "kuzey-market.png", file: "/samples/tr-market.png", preview: "/samples/tr-market.png", lang: "tr", scenario: "all_agreed" },
  { id: "tr-restaurant", fileName: "deniz-kizi.png", file: "/samples/tr-restaurant.png", preview: "/samples/tr-restaurant.png", lang: "tr", scenario: "arbiter_resolves" },
  { id: "en-coffee", fileName: "harbor-bean.png", file: "/samples/en-coffee.png", preview: "/samples/en-coffee.png", lang: "en", scenario: "missing_line" },
  { id: "en-invoice", fileName: "northwind-invoice.pdf", file: "/samples/en-invoice.pdf", preview: "/samples/en-invoice.png", lang: "en", scenario: "needs_review" },
  { id: "tr-kirtasiye", fileName: "kalem-kutusu.png", file: "/samples/tr-kirtasiye.png", preview: "/samples/tr-kirtasiye.png", lang: "tr", scenario: "extractor_failed" },
  { id: "tr-cafe", fileName: "kahve-duragi.png", file: "/samples/tr-cafe.png", preview: "/samples/tr-cafe.png", lang: "tr", scenario: "validation_catch" },
];
