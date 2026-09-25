import { describe, expect, it } from "vitest";
import {
  currenciesEqual,
  datesEqual,
  normalizeCurrency,
  normalizeDate,
  normalizeText,
  numbersEqual,
  parseLocaleNumber,
  textsEqual,
} from "@/lib/consensus/normalize";

describe("normalizeText", () => {
  it("folds Turkish characters and case", () => {
    expect(normalizeText("ŞOK MARKETLER")).toBe("sok marketler");
    expect(normalizeText("Çiğköfteci Ömer")).toBe("cigkofteci omer");
    expect(normalizeText("İSTANBUL")).toBe("istanbul");
    expect(normalizeText("ISPARTA")).toBe("isparta");
  });

  it("drops punctuation and legal suffixes", () => {
    expect(normalizeText("Migros Ticaret A.Ş.")).toBe("migros ticaret");
    expect(normalizeText("Acme, Inc.")).toBe("acme");
  });

  it("keeps a lone legal token rather than returning empty", () => {
    expect(normalizeText("Co")).toBe("co");
  });
});

describe("textsEqual", () => {
  it("treats diacritic / casing differences as equal", () => {
    expect(textsEqual("Beyaz Peynir", "BEYAZ PEYNİR")).toBe(true);
    expect(textsEqual("Şok Market", "Sok Market A.S.")).toBe(true);
  });

  it("tolerates a single OCR slip in a long string", () => {
    expect(textsEqual("Coffee House Downtown", "Coffee House Downtovn")).toBe(true);
  });

  it("rejects genuinely different values", () => {
    expect(textsEqual("Migros", "CarrefourSA")).toBe(false);
    expect(textsEqual("Ayran", null)).toBe(false);
  });

  it("treats two empties as equal", () => {
    expect(textsEqual(null, "")).toBe(true);
  });
});

describe("parseLocaleNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["12,5", 12.5],
    ["₺ 45,00", 45],
    ["1.234", 1234],
    ["-3,20", -3.2],
    ["$1,000", 1000],
  ])("%s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toBeCloseTo(expected, 6);
  });

  it("rejects malformed grouping instead of guessing", () => {
    // UI regression: typing into a non-empty field produced "2.000,501.054,80".
    expect(parseLocaleNumber("2.000,501.054,80")).toBeNull();
    expect(parseLocaleNumber("1.23.456")).toBeNull();
    expect(parseLocaleNumber("1,234.567,89")).toBeNull();
    expect(parseLocaleNumber("12.345.678,90")).toBeCloseTo(12345678.9, 6);
  });

  it("returns null for non-numbers", () => {
    expect(parseLocaleNumber("abc")).toBeNull();
    expect(parseLocaleNumber(undefined)).toBeNull();
    expect(parseLocaleNumber(Number.NaN)).toBeNull();
  });
});

describe("numbersEqual", () => {
  it("uses absolute tolerance for small values", () => {
    expect(numbersEqual(10.0, 10.01)).toBe(true);
    expect(numbersEqual(10.0, 10.02)).toBe(false);
  });

  it("uses relative tolerance for large values", () => {
    expect(numbersEqual(1000, 1000.9)).toBe(true);
    expect(numbersEqual(1000, 1004)).toBe(false);
  });

  it("handles nulls", () => {
    expect(numbersEqual(null, null)).toBe(true);
    expect(numbersEqual(null, 0)).toBe(false);
  });

  it("ignores float noise", () => {
    expect(numbersEqual(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe("normalizeDate", () => {
  it.each([
    ["2026-03-07", "2026-03-07"],
    ["07.03.2026", "2026-03-07"],
    ["7/3/26", "2026-03-07"],
    ["2026/3/7 14:22", "2026-03-07"],
    ["03/25/2026", "2026-03-25"], // day-first impossible → month-first
  ])("%s → %s", (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it("rejects impossible dates", () => {
    expect(normalizeDate("31.02.2026")).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
  });

  it("compares across formats", () => {
    expect(datesEqual("2026-03-07", "07.03.2026")).toBe(true);
    expect(datesEqual("2026-03-07", "2026-03-08")).toBe(false);
  });
});

describe("currency", () => {
  it("maps symbols and local names to ISO codes", () => {
    expect(normalizeCurrency("₺")).toBe("TRY");
    expect(normalizeCurrency("tl")).toBe("TRY");
    expect(normalizeCurrency("€")).toBe("EUR");
    expect(normalizeCurrency("usd")).toBe("USD");
  });

  it("compares normalised codes", () => {
    expect(currenciesEqual("TL", "TRY")).toBe(true);
    expect(currenciesEqual("USD", "EUR")).toBe(false);
  });
});
