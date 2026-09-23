/**
 * Renders the demo documents in public/samples/ from code, so the repo
 * contains no third-party receipts. All businesses and numbers are fictional.
 *
 *   npm run generate-samples
 *
 * "faded" lines are rendered blurred/low-contrast: they explain, visually, why
 * a model could misread them in the demo scenarios.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const OUT = new URL("../public/samples/", import.meta.url);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Thermal receipt renderer ────────────────────────────────

const W = 400;
const PAD = 26;
const LINE = 23;

/** line: string | { l, r, c, bold, big, faded, rule } */
function receiptSvg(lines, { rotate = 0 } = {}) {
  const H = PAD * 2 + lines.length * LINE + 20;
  let y = PAD + 18;
  const out = [];
  for (const raw of lines) {
    const line = typeof raw === "string" ? { c: raw } : raw;
    const size = line.big ? 17 : 14;
    const weight = line.bold || line.big ? 700 : 400;
    const style = `font-size="${size}" font-weight="${weight}"${line.faded ? ' filter="url(#smudge)" fill-opacity="0.55"' : ""}`;
    if (line.rule) {
      out.push(`<line x1="${PAD}" x2="${W - PAD}" y1="${y - 16}" y2="${y - 16}" stroke="#333" stroke-dasharray="4 3"/>`);
    }
    if (line.c !== undefined) out.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" ${style}>${esc(line.c)}</text>`);
    if (line.l !== undefined) out.push(`<text x="${PAD}" y="${y}" ${style}>${esc(line.l)}</text>`);
    if (line.r !== undefined) out.push(`<text x="${W - PAD}" y="${y}" text-anchor="end" ${style}>${esc(line.r)}</text>`);
    y += LINE;
  }
  const M = 30; // margin around the paper for the shadow
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + M * 2}" height="${H + M * 2}">
  <defs>
    <filter id="smudge"><feGaussianBlur stdDeviation="0.9"/></filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-opacity="0.18"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="#e9e6df"/>
  <g transform="translate(${M} ${M}) rotate(${rotate} ${W / 2} ${H / 2})">
    <rect width="${W}" height="${H}" fill="#fcfbf7" filter="url(#shadow)"/>
    <g font-family="Courier New, Consolas, monospace" fill="#1d1d1d">${out.join("\n")}</g>
  </g>
</svg>`;
}

async function png(name, svg) {
  await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(name, OUT)));
  console.log("✓", name);
}

// ── Samples ──────────────────────────────────────────────────

const trMarket = [
  { c: "KUZEY GIDA MARKET LTD. ŞTİ.", big: true },
  "Atatürk Cad. No:12 Kadıköy",
  "İSTANBUL",
  "KADIKÖY V.D. 0000000000",
  { l: "TARİH: 14.09.2026", r: "SAAT: 18:42", rule: true },
  { l: "FİŞ NO: 0042", r: "KASA: 03" },
  { l: "2 X 12,50", rule: true },
  { l: "EKMEK", r: "%1   *25,00" },
  { l: "1 X 289,90" },
  { l: "BEYAZ PEYNİR", r: "%1  *289,90" },
  { l: "6 X 9,75" },
  { l: "AYRAN", r: "%1   *58,50" },
  { l: "1,250 KG X 34,90" },
  { l: "DOMATES", r: "%1   *43,63" },
  { l: "İNDİRİM", r: "-15,00" },
  { l: "TOPKDV", r: "*3,98", rule: true },
  { l: "TOPLAM", r: "*402,03", big: true },
  { l: "NAKİT", r: "*410,00" },
  { l: "PARA ÜSTÜ", r: "*7,97" },
  { c: "MALİ DEĞERİ YOKTUR — DEMO", rule: true },
];

const trRestaurant = [
  { c: "LOKANTA DENİZ KIZI", big: true },
  "Kordon Boyu No:8 Konak",
  "İZMİR",
  { l: "TARİH: 19.09.2026", r: "SAAT: 21:05", rule: true, faded: true },
  { l: "MASA: 7", r: "GARSON: AYŞE" },
  { l: "2 X 85,00", rule: true },
  { l: "MERCİMEK ÇORBA", r: "%10  *170,00" },
  { l: "2 X 245,00" },
  { l: "IZGARA KÖFTE", r: "%10  *490,00" },
  { l: "1 X 95,00" },
  { l: "ÇOBAN SALATA", r: "%10   *95,00" },
  { l: "1 X 140,00" },
  { l: "KÜNEFE", r: "%10  *140,00" },
  { l: "4 X 15,00" },
  { l: "ÇAY", r: "%10   *60,00" },
  { l: "TOPKDV", r: "*86,82", rule: true },
  { l: "TOPLAM", r: "*955,00", big: true, faded: true },
  { l: "KREDİ KARTI", r: "*955,00" },
  { c: "AFİYET OLSUN — DEMO", rule: true },
];

const enCoffee = [
  { c: "HARBOR BEAN COFFEE CO.", big: true },
  "114 Pier Street",
  "Portland, ME",
  { l: "08/02/2026", r: "7:48 AM", rule: true },
  { l: "Order #2291", r: "Server: Sam" },
  { l: "2 Oat Latte @ 5.25", r: "10.50", rule: true },
  { l: "1 Blueberry Muffin @ 3.75", r: "3.75", faded: true },
  { l: "1 Cold Brew @ 4.95", r: "4.95" },
  { l: "1 Avocado Toast @ 9.50", r: "9.50" },
  { l: "Subtotal", r: "28.70", rule: true },
  { l: "Tax 8.875%", r: "2.55" },
  { l: "TOTAL", r: "$31.25", big: true },
  { l: "VISA ****0000", r: "31.25" },
  { c: "Thank you! — DEMO", rule: true },
];

const trCafe = [
  { c: "KAHVE DURAĞI", big: true },
  "Tunalı Hilmi Cad. No:55",
  "Çankaya / ANKARA",
  { l: "TARİH: 21.09.2026", r: "SAAT: 16:20", rule: true },
  { l: "FİŞ NO: 0187" },
  { l: "2 X 60,00", rule: true },
  { l: "TÜRK KAHVESİ", r: "%10  *120,00" },
  { l: "2 X 15,00" },
  { l: "SU", r: "%10   *30,00" },
  { l: "1 X 185,00" },
  { l: "SAN SEBASTIAN", r: "%10  *185,00" },
  { l: "1 X 54,00", faded: true },
  { l: "LİMONATA", r: "%10   *54,00", faded: true },
  { l: "TOPKDV", r: "*35,36", rule: true },
  { l: "TOPLAM", r: "*389,00", big: true },
  { l: "NAKİT", r: "*400,00" },
  { l: "PARA ÜSTÜ", r: "*11,00" },
  { c: "MALİ DEĞERİ YOKTUR — DEMO", rule: true },
];

const trKirtasiye = [
  { c: "KALEM KUTUSU KIRTASİYE", big: true },
  "Cumhuriyet Mah. Okul Sok. No:3",
  "Nilüfer / BURSA",
  { l: "TARİH: 22.09.2026", r: "SAAT: 10:05", rule: true },
  { l: "FİŞ NO: 0311" },
  { l: "3 X 45,00", rule: true },
  { l: "DEFTER A4", r: "%20  *135,00" },
  { l: "5 X 12,50" },
  { l: "KALEM", r: "%20   *62,50" },
  { l: "2 X 8,00", faded: true },
  { l: "SİLGİ", r: "%20   *16,00", faded: true },
  { l: "TOPKDV", r: "*35,58", rule: true },
  { l: "TOPLAM", r: "*213,50", big: true },
  { l: "KREDİ KARTI", r: "*213,50" },
  { c: "MALİ DEĞERİ YOKTUR — DEMO", rule: true },
];

// ── A4 invoice (PDF + PNG preview) ───────────────────────────

const invoice = {
  seller: ["Northwind Studio Ltd.", "4 Harbour Lane, Bristol BS1 5DB", "VAT No. GB000 0000 00 (demo)"],
  buyer: ["Bill to:", "Kestrel Outdoor GmbH", "Hauptstr. 9, 10115 Berlin"],
  meta: [["Invoice no.", "INV-2026-0142"], ["Invoice date", "01/09/2026"], ["Due date", "01/10/2026"]],
  items: [
    ["Web design (hours)", "12", "65.00", "780.00"],
    ["Hosting (annual)", "1", "120.00", "120.00"],
    ["Domain renewal", "2", "14.50", "29.00"],
    ["Loyalty discount", "", "", "-50.00"],
  ],
  totals: [["Subtotal", "879.00"], ["VAT 20%", "175.80"], ["Total (EUR)", "1,054.80"]],
};

async function invoicePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.14);
  const text = (s, x, y, o = {}) => {
    const f = o.bold ? bold : font;
    const size = o.size ?? 10;
    const dx = o.right ? f.widthOfTextAtSize(s, size) : 0;
    page.drawText(s, { x: x - dx, y, size, font: f, color: o.color ?? ink });
  };

  text("INVOICE", 50, 780, { bold: true, size: 24 });
  invoice.seller.forEach((s, i) => text(s, 545, 790 - i * 14, { right: true, bold: i === 0 }));
  invoice.buyer.forEach((s, i) => text(s, 50, 720 - i * 14, { bold: i === 1 }));
  invoice.meta.forEach(([k, v], i) => {
    text(k, 380, 720 - i * 14, { color: rgb(0.4, 0.4, 0.45) });
    text(v, 545, 720 - i * 14, { right: true });
  });

  let y = 640;
  page.drawRectangle({ x: 50, y: y - 6, width: 495, height: 22, color: rgb(0.93, 0.94, 0.96) });
  ["Description", "Qty", "Unit price", "Amount"].forEach((h, i) =>
    text(h, [58, 360, 450, 537][i], y, { bold: true, right: i > 0 }),
  );
  for (const row of invoice.items) {
    y -= 26;
    text(row[0], 58, y);
    [row[1], row[2], row[3]].forEach((v, i) => text(v, [360, 450, 537][i], y, { right: true }));
  }
  y -= 18;
  page.drawLine({ start: { x: 320, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.7, 0.7, 0.75) });
  for (const [k, v] of invoice.totals) {
    y -= 20;
    const last = k.startsWith("Total");
    text(k, 380, y, { bold: last });
    text(v, 537, y, { right: true, bold: last });
  }
  text("Payment terms: 30 days. Bank transfer to IBAN GB00 DEMO 0000 0000 0000 00.", 50, 90, { size: 9 });
  text("Fictional document generated for the AI Receipt & Invoice Reader demo.", 50, 74, { size: 8, color: rgb(0.5, 0.5, 0.55) });

  // Page 2 exists on purpose: the app processes the first page only (v1).
  const p2 = doc.addPage([595, 842]);
  p2.drawText("Terms and conditions (page 2 — ignored by the reader in v1).", { x: 50, y: 780, size: 10, font });

  await writeFile(new URL("en-invoice.pdf", OUT), await doc.save());
  console.log("✓ en-invoice.pdf");
}

function invoicePreviewSvg() {
  const t = (s, x, y, o = {}) =>
    `<text x="${x}" y="${y}" font-size="${o.size ?? 10}" font-weight="${o.bold ? 700 : 400}"${o.right ? ' text-anchor="end"' : ""} fill="${o.color ?? "#1f1f24"}">${esc(s)}</text>`;
  const top = (y) => 842 - y; // PDF → SVG coordinates
  const parts = [t("INVOICE", 50, top(780), { bold: true, size: 24 })];
  invoice.seller.forEach((s, i) => parts.push(t(s, 545, top(790 - i * 14), { right: true, bold: i === 0 })));
  invoice.buyer.forEach((s, i) => parts.push(t(s, 50, top(720 - i * 14), { bold: i === 1 })));
  invoice.meta.forEach(([k, v], i) => {
    parts.push(t(k, 380, top(720 - i * 14), { color: "#666670" }), t(v, 545, top(720 - i * 14), { right: true }));
  });
  let y = 640;
  parts.push(`<rect x="50" y="${top(y + 16)}" width="495" height="22" fill="#edeff4"/>`);
  ["Description", "Qty", "Unit price", "Amount"].forEach((h, i) => parts.push(t(h, [58, 360, 450, 537][i], top(y), { bold: true, right: i > 0 })));
  for (const row of invoice.items) {
    y -= 26;
    parts.push(t(row[0], 58, top(y)));
    [row[1], row[2], row[3]].forEach((v, i) => parts.push(t(v, [360, 450, 537][i], top(y), { right: true })));
  }
  y -= 18;
  parts.push(`<line x1="320" x2="545" y1="${top(y)}" y2="${top(y)}" stroke="#b3b3bf" stroke-width="0.8"/>`);
  for (const [k, v] of invoice.totals) {
    y -= 20;
    const last = k.startsWith("Total");
    parts.push(t(k, 380, top(y), { bold: last }), t(v, 537, top(y), { right: true, bold: last }));
  }
  parts.push(t("Payment terms: 30 days. Bank transfer to IBAN GB00 DEMO 0000 0000 0000 00.", 50, top(90), { size: 9 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><rect width="100%" height="100%" fill="#ffffff"/><g font-family="Helvetica, Arial, sans-serif">${parts.join("")}</g></svg>`;
}

await mkdir(OUT, { recursive: true });
await png("tr-market.png", receiptSvg(trMarket, { rotate: -0.8 }));
await png("tr-restaurant.png", receiptSvg(trRestaurant, { rotate: 0.6 }));
await png("en-coffee.png", receiptSvg(enCoffee, { rotate: -0.4 }));
await png("tr-cafe.png", receiptSvg(trCafe, { rotate: 0.9 }));
await png("tr-kirtasiye.png", receiptSvg(trKirtasiye, { rotate: -0.6 }));
await invoicePdf();
await png("en-invoice.png", invoicePreviewSvg());
