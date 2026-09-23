import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, resolveLang } from "@/lib/i18n/shared";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "AI Receipt & Invoice Reader",
  description:
    "Open-source receipt and invoice reader: two vision models read every document, a blind arbiter settles disagreements, and humans review the rest.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = resolveLang((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">{children}</body>
    </html>
  );
}
