/**
 * Normalisation helpers used to decide whether two model readings "agree".
 * Everything here is pure and locale-aware for Turkish and English receipts.
 */

// ── Text ─────────────────────────────────────────────────────

/** Legal-form tokens that one model may print and the other may drop. */
const LEGAL_SUFFIXES = new Set([
  "as", "aş", "ltd", "sti", "şti", "tic", "san", "ve", "inc", "llc", "gmbh", "co", "corp", "plc",
]);

/**
 * Canonical form for fuzzy text comparison:
 * NFKC → Turkish-aware lower-case → fold diacritics (ş→s, ı→i, ö→o …)
 * → drop punctuation → drop legal suffixes → collapse whitespace.
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  const lowered = input.normalize("NFKC").toLocaleLowerCase("tr-TR");
  const rawTokens = lowered
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const tokens = mergeInitials(rawTokens);
  // Only strip suffixes when something meaningful remains.
  const core = tokens.filter((t) => !LEGAL_SUFFIXES.has(t));
  return (core.length > 0 ? core : tokens).join(" ");
}

/** Joins runs of single-letter tokens, so "A.Ş." (→ "a s") becomes "as". */
function mergeInitials(tokens: string[]): string[] {
  const out: string[] = [];
  let run = "";
  for (const t of tokens) {
    if (t.length === 1 && /\p{L}/u.test(t)) {
      run += t;
      continue;
    }
    if (run) out.push(run);
    run = "";
    out.push(t);
  }
  if (run) out.push(run);
  return out;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Similarity in [0, 1] on normalised text. */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

export const TEXT_EQUAL_THRESHOLD = 0.9;

/** Fuzzy match — used to decide whether two lines are the same purchase. */
export function textsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return textSimilarity(a, b) >= TEXT_EQUAL_THRESHOLD;
}

/**
 * Value agreement for voting: equal only when the normalised forms are identical.
 * Case, diacritics, punctuation and legal suffixes are ignored, but a single
 * differing letter ("Duracı" vs "Durağı") is a real disagreement: a fuzzy match
 * here would silently keep reader A's spelling.
 */
export function textValuesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeText(a) === normalizeText(b);
}

// ── Numbers ──────────────────────────────────────────────────

export const NUMBER_ABS_TOLERANCE = 0.01;
/**
 * 0.1 % — only absorbs rounding on large amounts. Printed money is exact, so a
 * looser band (e.g. 0.5 %) would accept real misreads like 1000 vs 1004.
 */
export const NUMBER_REL_TOLERANCE = 0.001;

/**
 * Parses numbers as printed on TR or EN receipts:
 * "1.234,56" → 1234.56, "1,234.56" → 1234.56, "12,5" → 12.5, "₺ 45,00" → 45.
 * The right-most separator is treated as the decimal mark when it is
 * followed by 1–2 digits; otherwise separators are thousands groupings.
 */
export function parseLocaleNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[^\d.,\-]/g, "");
  if (!/\d/.test(s)) return null;
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");

  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let intPart = s;
  let fracPart = "";
  if (lastSep !== -1) {
    const tail = s.slice(lastSep + 1);
    if (tail.length >= 1 && tail.length <= 2) {
      intPart = s.slice(0, lastSep);
      fracPart = tail;
    }
  }
  // Grouping must be well-formed: one separator kind, groups of three digits,
  // and never the decimal mark itself ("2.000,501.054,80" is garbage, not a number).
  if (/[.,]/.test(intPart)) {
    const seps = new Set(intPart.match(/[.,]/g));
    const decimalMark = fracPart ? s[lastSep] : null;
    if (seps.size > 1 || (decimalMark && seps.has(decimalMark)) || !/^\d{1,3}([.,]\d{3})+$/.test(intPart)) return null;
  }
  intPart = intPart.replace(/[.,]/g, "");
  const n = Number(`${intPart || "0"}${fracPart ? `.${fracPart}` : ""}`);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function numbersEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const tolerance = Math.max(NUMBER_ABS_TOLERANCE, NUMBER_REL_TOLERANCE * Math.max(Math.abs(a), Math.abs(b)));
  // Epsilon guards float noise like 0.1 + 0.2.
  return Math.abs(a - b) <= tolerance + 1e-9;
}

// ── Dates ────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function isValidYmd(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Converts common receipt date formats to ISO YYYY-MM-DD.
 * Day-first is assumed for ambiguous inputs (TR/EU convention) unless the
 * day-first reading is impossible, in which case month-first is tried.
 */
export function normalizeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();

  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})\b/);
  if (m) {
    const [p1, p2, y] = [Number(m[1]), Number(m[2]), expandYear(Number(m[3]))];
    if (isValidYmd(y, p2, p1)) return `${y}-${pad(p2)}-${pad(p1)}`;
    if (isValidYmd(y, p1, p2)) return `${y}-${pad(p1)}-${pad(p2)}`;
  }
  return null;
}

export function datesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeDate(a);
  const nb = normalizeDate(b);
  if (!a && !b) return true;
  if (na && nb) return na === nb;
  // Unparseable on either side: fall back to exact trimmed comparison.
  return (a ?? "").trim() === (b ?? "").trim();
}

// ── Currency ─────────────────────────────────────────────────

const CURRENCY_ALIASES: Record<string, string> = {
  "₺": "TRY", TL: "TRY", YTL: "TRY", TRL: "TRY",
  $: "USD", US$: "USD", USD: "USD",
  "€": "EUR", EURO: "EUR", EUR: "EUR",
  "£": "GBP", GBP: "GBP",
};

export function normalizeCurrency(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim().toLocaleUpperCase("en-US").replace(/\s+/g, "");
  if (!s) return null;
  return CURRENCY_ALIASES[s] ?? s;
}

export function currenciesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeCurrency(a) === normalizeCurrency(b);
}
