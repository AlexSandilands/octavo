import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_ICON_COLORS, DEFAULT_BRAND } from "../../src/lib/brands.ts";
import type { InvoiceConfig } from "./config.mts";
import type { FxResolution } from "./fx.mts";
import type { ComputedLine, ComputedTotals } from "./totals.mts";

// The invoice layout — the "template" half of the template + data split
// (issue #187). One fixed A4 page in the octavo house style: the heritage
// paper-and-green palette, the magazine's three type families (embedded as
// data URIs so the document is fully self-contained — Chromium needs no
// network and no dev server), and the octavo book mark from site-icon.tsx.
// The invoice is from octavo TO a client, so it carries octavo's branding
// regardless of any client magazine's skin.

// Heritage palette, mirrored from the @theme block in globals.css. This tool
// renders outside Next/Tailwind, so the tokens are restated here — if the
// heritage identity ever shifts, update these alongside globals.css.
const C = {
  paper: "#f4f0e8",
  ink: "#20201c",
  body: "#2a2722",
  muted: "#56524a",
  faint: "#615c50",
  faint2: "#6d685a",
  accent: "#1d4d3e",
  accentInk: "#143a2e",
  line: "#e6e0d3",
  hair: "#ddd6c8",
  rule: "#cfc6b4",
};

const FONTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/app/fonts",
);

function fontFace(
  family: string,
  file: string,
  weight: string,
  style: string,
): string {
  const data = readFileSync(join(FONTS_DIR, file)).toString("base64");
  return `@font-face {
    font-family: "${family}";
    src: url(data:font/woff2;base64,${data}) format("woff2");
    font-weight: ${weight};
    font-style: ${style};
  }`;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// "16 August 2026" — the audience-friendly long form, from a YYYY-MM-DD the
// schema already proved is a real date.
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

// "$33.09" / "US$60.00" — Intl's en-NZ currency style disambiguates foreign
// currencies for free, which is exactly the transparency the conversion needs.
function fmtMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// The octavo mark — the same two-parallelogram open book the app's icon route
// draws (src/lib/site-icon.tsx), on the brand accent, sized for print.
function markHtml(): string {
  const { bg, fg } = BRAND_ICON_COLORS[DEFAULT_BRAND];
  return `<div class="mark" style="background:${bg}">
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2.5 8 L15 11 L15 25.5 L2.5 22.5 Z" fill="${fg}" />
      <path d="M29.5 8 L17 11 L17 25.5 L29.5 22.5 Z" fill="${fg}" />
    </svg>
  </div>`;
}

function itemRow(line: ComputedLine, invoiceCurrency: string): string {
  const { item } = line;
  const unitPrice = fmtMoney(Math.round(item.amount * 100), line.currency);
  const per = item.unit ? ` / ${esc(item.unit)}` : "";
  // A converted line shows its native total under the invoice-currency amount
  // so the original is always on the page next to what it became.
  const nativeNote = line.foreign
    ? `<div class="native">${fmtMoney(line.nativeCents, line.currency)}</div>`
    : "";
  return `<tr>
    <td class="desc">${esc(item.description)}</td>
    <td class="qty">${item.qty}</td>
    <td class="unit-price">${unitPrice}${per}</td>
    <td class="amount">${fmtMoney(line.invoiceCents, invoiceCurrency)}${nativeNote}</td>
  </tr>`;
}

function totalsHtml(config: InvoiceConfig, totals: ComputedTotals): string {
  const cur = config.currency;
  const rows: string[] = [];
  if (totals.gstCents !== null && config.gst) {
    rows.push(`<div class="totals-row">
      <span class="totals-label">Subtotal</span>
      <span class="totals-value">${fmtMoney(totals.subtotalCents, cur)}</span>
    </div>`);
    rows.push(`<div class="totals-row">
      <span class="totals-label">${esc(config.gst.label ?? `GST ${config.gst.rate}%`)}</span>
      <span class="totals-value">${fmtMoney(totals.gstCents, cur)}</span>
    </div>`);
  }
  rows.push(`<div class="totals-row total-due">
    <span class="totals-label">Total due <span class="cur">${esc(cur)}</span></span>
    <span class="totals-value">${fmtMoney(totals.totalCents, cur)}</span>
  </div>`);
  return rows.join("\n");
}

function fxNote(fx: FxResolution | null): string {
  if (!fx) return "";
  return `<p class="fx-note">Converted at 1 ${esc(fx.from)} = ${fx.rate.toFixed(4)} ${esc(fx.to)}, European Central Bank rate of ${fmtDate(fx.date)}.</p>`;
}

export function renderInvoiceHtml(
  config: InvoiceConfig,
  totals: ComputedTotals,
  fx: FxResolution | null,
): string {
  const inv = config.invoice;
  const contactLines = (lines: string[], cls: string) =>
    lines.map((l) => `<div class="${cls}">${esc(l)}</div>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(inv.number)}</title>
<style>
  ${fontFace("Newsreader", "newsreader-roman.woff2", "200 800", "normal")}
  ${fontFace("Newsreader", "newsreader-italic.woff2", "200 800", "italic")}
  ${fontFace("Hanken Grotesk", "hanken-grotesk.woff2", "100 900", "normal")}
  ${fontFace("IBM Plex Mono", "ibm-plex-mono-400.woff2", "400", "normal")}
  ${fontFace("IBM Plex Mono", "ibm-plex-mono-500.woff2", "500", "normal")}

  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: ${C.paper}; }
  body {
    font-family: "Hanken Grotesk", system-ui, sans-serif;
    color: ${C.ink};
    -webkit-font-smoothing: antialiased;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 17mm 19mm 14mm;
    display: flex;
    flex-direction: column;
  }
  .caps {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${C.faint2};
  }

  /* ---- header: mark + issuer on the left, the invoice identity right ---- */
  header { display: flex; justify-content: space-between; align-items: flex-start; }
  .identity { display: flex; gap: 5.5mm; align-items: flex-start; }
  .mark {
    width: 14mm; height: 14mm; border-radius: 2.5mm;
    display: flex; align-items: center; justify-content: center;
    flex: none;
  }
  .mark svg { width: 11.5mm; height: 11.5mm; }
  .issuer-name {
    font-family: "Newsreader", Georgia, serif;
    font-size: 21pt; font-weight: 500; line-height: 1.1;
    letter-spacing: 0.01em; margin-top: 0.5mm;
  }
  .issuer-contact { margin-top: 2mm; font-size: 9pt; line-height: 1.5; color: ${C.muted}; }
  .doc-id { text-align: right; }
  .doc-title { font-size: 10pt; letter-spacing: 0.32em; text-transform: uppercase;
    font-weight: 600; color: ${C.accent}; }
  .doc-number { font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-weight: 500; font-size: 12.5pt; margin-top: 1.5mm; }
  .doc-period { font-size: 9.5pt; color: ${C.muted}; margin-top: 1.5mm; }

  header + hr { border: none; border-top: 1px solid ${C.rule}; margin: 8mm 0 0; }

  /* ---- billed-to and dates band ---- */
  .band { display: flex; justify-content: space-between; align-items: flex-start;
    margin-top: 7mm; }
  .client-name { font-family: "Newsreader", Georgia, serif; font-size: 13.5pt;
    font-weight: 500; margin-top: 2mm; }
  .client-contact { margin-top: 1.2mm; font-size: 9.5pt; line-height: 1.5; color: ${C.muted}; }
  .dates { display: flex; gap: 12mm; text-align: right; }
  .date-value { font-size: 10pt; color: ${C.body}; margin-top: 2mm; }

  /* ---- items ---- */
  table { width: 100%; border-collapse: collapse; margin-top: 9mm; }
  thead th { text-align: left; padding: 0 0 2.2mm; white-space: nowrap;
    border-bottom: 1px solid ${C.rule}; }
  thead th.num, td.qty, td.unit-price, td.amount { text-align: right; }
  thead th.num { padding-left: 8mm; }
  tbody td { padding: 3.2mm 0; border-bottom: 1px solid ${C.line};
    vertical-align: top; font-size: 10pt; color: ${C.body}; }
  td.desc { padding-right: 6mm; }
  td.qty { color: ${C.muted}; }
  td.unit-price { color: ${C.muted}; white-space: nowrap; padding-left: 6mm; }
  td.amount { font-family: "IBM Plex Mono", ui-monospace, monospace;
    white-space: nowrap; padding-left: 8mm; }
  td.amount .native { font-family: "Hanken Grotesk", system-ui, sans-serif;
    font-size: 8pt; color: ${C.faint2}; margin-top: 0.8mm; }

  /* ---- totals ---- */
  .totals { margin-left: auto; margin-top: 5mm; width: 62mm; }
  .totals-row { display: flex; justify-content: space-between;
    align-items: baseline; padding: 1.8mm 0; }
  .totals-label { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.18em;
    text-transform: uppercase; color: ${C.faint}; }
  .totals-value { font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 10pt; }
  .total-due { border-top: 1px solid ${C.rule}; margin-top: 1mm; padding-top: 3mm; }
  .total-due .totals-label { color: ${C.accent}; }
  .total-due .totals-value { font-weight: 500; font-size: 14pt; color: ${C.accentInk}; }
  .cur { letter-spacing: 0.08em; }
  .fx-note { margin-top: 4mm; font-size: 8.5pt; color: ${C.faint2}; text-align: right; }

  /* ---- payment + notes ---- */
  .payment { margin-top: 10mm; padding-top: 5mm; border-top: 1px solid ${C.hair}; }
  .payment-line { font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 9.5pt; line-height: 1.7; color: ${C.body}; }
  .payment .due { margin-top: 2.5mm; font-size: 9.5pt; color: ${C.muted};
    font-family: "Hanken Grotesk", system-ui, sans-serif; }
  .payment-line:first-of-type { margin-top: 2.5mm; }
  .notes { margin-top: 7mm; font-family: "Newsreader", Georgia, serif;
    font-style: italic; font-size: 10.5pt; line-height: 1.55; color: ${C.muted};
    max-width: 125mm; white-space: pre-line; }

  /* ---- running footer, pinned to the sheet's bottom edge ---- */
  .foot-spacer { flex: 1; }
  footer { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid ${C.hair};
    display: flex; justify-content: space-between; font-size: 8pt; color: ${C.faint2}; }
  footer .num { font-family: "IBM Plex Mono", ui-monospace, monospace; }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div class="identity">
      ${markHtml()}
      <div>
        <div class="issuer-name">${esc(config.issuer.name)}</div>
        <div class="issuer-contact">${contactLines(config.issuer.contact, "line")}</div>
      </div>
    </div>
    <div class="doc-id">
      <div class="doc-title">Invoice</div>
      <div class="doc-number">${esc(inv.number)}</div>
      ${inv.period ? `<div class="doc-period">${esc(inv.period)}</div>` : ""}
    </div>
  </header>
  <hr />

  <div class="band">
    <div>
      <div class="caps">Billed to</div>
      <div class="client-name">${esc(config.client.name)}</div>
      ${config.client.contact ? `<div class="client-contact">${contactLines(config.client.contact, "line")}</div>` : ""}
    </div>
    <div class="dates">
      <div>
        <div class="caps">Issued</div>
        <div class="date-value">${fmtDate(inv.issueDate)}</div>
      </div>
      <div>
        <div class="caps">Due</div>
        <div class="date-value">${fmtDate(inv.dueDate)}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="caps">Description</th>
        <th class="caps num">Qty</th>
        <th class="caps num">Unit price</th>
        <th class="caps num">Amount (${esc(config.currency)})</th>
      </tr>
    </thead>
    <tbody>
      ${totals.lines.map((l) => itemRow(l, config.currency)).join("\n")}
    </tbody>
  </table>

  <div class="totals">
    ${totalsHtml(config, totals)}
  </div>
  ${fxNote(fx)}

  <div class="payment">
    <div class="caps">Payment</div>
    ${contactLines(config.issuer.payment, "payment-line")}
    <div class="due">Due by ${fmtDate(inv.dueDate)}.</div>
  </div>

  ${config.notes ? `<div class="notes">${esc(config.notes.trim())}</div>` : ""}

  <div class="foot-spacer"></div>
  <footer>
    <span class="num">${esc(inv.number)}</span>
    <span>${esc(config.issuer.name)}</span>
  </footer>
</div>
</body>
</html>`;
}
