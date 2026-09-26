"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ValidationWarning } from "@/lib/consensus/validate";
import type { Notice } from "@/lib/pipeline";
import { en, type Dictionary } from "./en";
import { LANG_COOKIE, format, type Lang } from "./shared";
import { tr } from "./tr";

export { LANGS, type Lang } from "./shared";

const DICTIONARIES: Record<Lang, Dictionary> = { tr, en };

type I18n = {
  lang: Lang;
  t: Dictionary;
  setLang: (lang: Lang) => void;
  f: typeof format;
  /** Locale-aware number, e.g. 1.234,56 (tr) / 1,234.56 (en). */
  num: (n: number | null | undefined) => string;
  /** Without forced decimals, for quantities. */
  numPlain: (n: number | null | undefined) => string;
  warning: (w: ValidationWarning) => string;
  notice: (n: Notice) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<I18n>(() => {
    const t = DICTIONARIES[lang];
    const nf = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const plain = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 3 });
    const num = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
    const numPlain = (n: number | null | undefined) => (n == null ? "—" : plain.format(n));
    return {
      lang,
      t,
      setLang,
      f: format,
      num,
      numPlain,
      warning: (w) => {
        switch (w.code) {
          case "total_missing":
            return t.validation.total_missing;
          case "items_total_mismatch":
            return format(t.validation.items_total_mismatch, { itemsSum: num(w.itemsSum), total: num(w.total) });
          case "subtotal_mismatch":
            return format(t.validation.subtotal_mismatch, { subtotal: num(w.subtotal), tax: num(w.tax), total: num(w.total) });
          case "line_math_mismatch":
            return format(t.validation.line_math_mismatch, {
              line: w.index + 1,
              qty: num(w.qty),
              unitPrice: num(w.unitPrice),
              amount: num(w.amount),
            });
          case "line_amount_missing":
            return format(t.validation.line_amount_missing, { line: w.index + 1 });
        }
      },
      notice: (n) => {
        switch (n.code) {
          case "pdf_pages":
            return format(n.rendered ? t.notices.pdf_pages_rendered : t.notices.pdf_pages, { n: n.pageCount });
          case "extractor_failed":
            return format(t.notices.extractor_failed, { reader: n.reader.toUpperCase() });
          case "arbiter_failed":
            return t.notices.arbiter_failed;
        }
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

