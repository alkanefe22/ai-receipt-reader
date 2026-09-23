export const LANGS = ["tr", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_COOKIE = "lang";

/** "{name} is {n}" + { name: "x", n: 2 } → "x is 2" */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in params ? String(params[key]) : `{${key}}`));
}

/** Cookie first, then Accept-Language, then Turkish. */
export function resolveLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (cookie === "tr" || cookie === "en") return cookie;
  const preferred = acceptLanguage?.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return preferred === "en" ? "en" : "tr";
}
