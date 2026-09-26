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

// ── Two-page A4 invoice (PDF + PNG preview of page 1) ─────
// Items run across both pages with a "Carried forward" running sum, and the
// totals sit on page 2, so a reader must use every page and must not count
// the carried/brought-forward lines as items.

const invoice = {
  seller: ["Northwind Studio Ltd.", "4 Harbour Lane, Bristol BS1 5DB", "VAT No. GB000 0000 00 (demo)"],
  buyer: ["Bill to:", "Kestrel Outdoor GmbH", "Hauptstr. 9, 10115 Berlin"],
  meta: [["Invoice no.", "INV-2026-0142"], ["Invoice date", "01/09/2026"], ["Due date", "01/10/2026"]],
  page1: [
    ["Web design (hours)", "12", "65.00", "780.00"],
    ["UX workshop (day)", "1", "450.00", "450.00"],
    ["Hosting (annual)", "1", "120.00", "120.00"],
    ["Domain renewal", "2", "14.50", "29.00"],
    ["SSL certificate", "1", "60.00", "60.00"],
  ],
  carried: "1,439.00",
  page2: [
    ["Content migration (hours)", "6", "55.00", "330.00"],
    ["Training session", "1", "200.00", "200.00"],
    ["Loyalty discount", "", "", "-50.00"],
  ],
  totals: [["Subtotal", "1,919.00"], ["VAT 20%", "383.80"], ["Total (EUR)", "2,302.80"]],
};

async function invoicePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.14);
  const grey = rgb(0.4, 0.4, 0.45);
  const writer = (page) => (s, x, y, o = {}) => {
    const f = o.bold ? bold : font;
    const size = o.size ?? 10;
    const dx = o.right ? f.widthOfTextAtSize(s, size) : 0;
    page.drawText(s, { x: x - dx, y, size, font: f, color: o.color ?? ink });
  };
  const COLS = [360, 450, 537];
  const tableHeader = (page, text, y) => {
    page.drawRectangle({ x: 50, y: y - 6, width: 495, height: 22, color: rgb(0.93, 0.94, 0.96) });
    ["Description", "Qty", "Unit price", "Amount"].forEach((h, i) => text(h, [58, ...COLS][i], y, { bold: true, right: i > 0 }));
  };
  const rows = (text, items, y) => {
    for (const row of items) {
      y -= 26;
      text(row[0], 58, y);
      [row[1], row[2], row[3]].forEach((v, i) => text(v, COLS[i], y, { right: true }));
    }
    return y;
  };
  const footer = (text, n) => {
    text("Fictional document generated for the AI Receipt & Invoice Reader demo.", 50, 74, { size: 8, color: rgb(0.5, 0.5, 0.55) });
    text(`Page ${n} of 2`, 545, 74, { size: 8, right: true, color: grey });
  };

  // Page 1: header, first items, carried-forward running sum.
  const p1 = doc.addPage([595, 842]);
  const t1 = writer(p1);
  t1("INVOICE", 50, 780, { bold: true, size: 24 });
  invoice.seller.forEach((s, i) => t1(s, 545, 790 - i * 14, { right: true, bold: i === 0 }));
  invoice.buyer.forEach((s, i) => t1(s, 50, 720 - i * 14, { bold: i === 1 }));
  invoice.meta.forEach(([k, v], i) => {
    t1(k, 380, 720 - i * 14, { color: grey });
    t1(v, 545, 720 - i * 14, { right: true });
  });
  tableHeader(p1, t1, 640);
  let y = rows(t1, invoice.page1, 640) - 30;
  t1("Carried forward", 380, y, { color: grey });
  t1(invoice.carried, 537, y, { right: true, color: grey });
  footer(t1, 1);

  // Page 2: brought-forward sum, remaining items, totals, terms.
  const p2 = doc.addPage([595, 842]);
  const t2 = writer(p2);
  t2("Northwind Studio Ltd. · Invoice INV-2026-0142 (continued)", 50, 790, { bold: true, size: 11 });
  tableHeader(p2, t2, 750);
  t2("Brought forward", 380, 724, { color: grey });
  t2(invoice.carried, 537, 724, { right: true, color: grey });
  y = rows(t2, invoice.page2, 724) - 18;
  p2.drawLine({ start: { x: 320, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.7, 0.7, 0.75) });
  for (const [k, v] of invoice.totals) {
    y -= 20;
    const last = k.startsWith("Total");
    t2(k, 380, y, { bold: last });
    t2(v, 537, y, { right: true, bold: last });
  }
  t2("Payment terms: 30 days. Bank transfer to IBAN GB00 DEMO 0000 0000 0000 00.", 50, 90, { size: 9 });
  footer(t2, 2);

  const bytes = await doc.save();
  await writeFile(new URL("en-invoice.pdf", OUT), bytes);
  console.log("✓ en-invoice.pdf (2 pages)");
  return bytes;
}

/**
 * One PNG per page, rendered from the PDF itself with pdf.js: "<base>.png" is
 * page 1 (also the thumbnail), then "<base>-p2.png", … The demo shows these
 * instead of an inline PDF viewer, which some browsers (e.g. Android Chrome) lack.
 */
async function pdfPreview(bytes, base) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = fileURLToPath(new URL("../node_modules/pdfjs-dist/", import.meta.url)).replaceAll("\\", "/");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: `${root}standard_fonts/`, disableFontFace: true });
  const pdf = await task.promise;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const { canvas, context } = pdf.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: null, canvasContext: context, viewport, background: "#ffffff" }).promise;
    const name = n === 1 ? `${base}.png` : `${base}-p${n}.png`;
    await writeFile(new URL(name, OUT), canvas.toBuffer("image/png"));
    console.log("✓", name);
  }
  await task.destroy();
}

await mkdir(OUT, { recursive: true });
await png("tr-market.png", receiptSvg(trMarket, { rotate: -0.8 }));
await png("tr-restaurant.png", receiptSvg(trRestaurant, { rotate: 0.6 }));
await png("en-coffee.png", receiptSvg(enCoffee, { rotate: -0.4 }));
await png("tr-cafe.png", receiptSvg(trCafe, { rotate: 0.9 }));
await png("tr-kirtasiye.png", receiptSvg(trKirtasiye, { rotate: -0.6 }));
await pdfPreview(await invoicePdf(), "en-invoice");
