import { cookies, headers } from "next/headers";
import { ReaderApp, type AppInfo } from "@/components/ReaderApp";
import { getConfig } from "@/lib/config";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { I18nProvider } from "@/lib/i18n";
import { LANG_COOKIE, resolveLang } from "@/lib/i18n/shared";
import { modelLabel } from "@/lib/providers";

export default async function Page() {
  const config = getConfig();
  const lang = resolveLang((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));

  // Only non-secret facts cross to the client.
  const info: AppInfo = {
    mode: config.mode,
    demoReason: config.demoReason,
    models:
      config.mode === "live"
        ? { a: modelLabel(config.extractorA!), b: modelLabel(config.extractorB!), arbiter: modelLabel(config.arbiter!) }
        : null,
    maxFileMb: Math.round(config.maxFileBytes / 1024 / 1024),
    samples: DEMO_SAMPLES,
  };

  return (
    <I18nProvider initialLang={lang}>
      <main>
        <ReaderApp info={info} />
      </main>
    </I18nProvider>
  );
}
