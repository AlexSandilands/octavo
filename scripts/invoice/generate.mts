import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  ChromiumUnavailableError,
  isMissingBrowser,
} from "../../src/lib/chromium.ts";
import { loadInvoiceConfig } from "./config.mts";
import { resolveFx } from "./fx.mts";
import { computeTotals } from "./totals.mts";
import { renderInvoiceHtml } from "./template.mts";

// Local invoice PDF generator (issue #187) — the CLI. Usage:
//
//   npm run invoice -- invoices/<name>.yml [--out <path>.pdf]
//
// Loads + validates the YAML config, resolves the exchange rate (pinned in
// the config, else fetched live from frankfurter.app), renders the invoice
// HTML and prints it to A4 with headless Chromium — the same
// render-HTML-then-print method the magazine PDF uses (src/lib/pdf.ts), but
// fully standalone: no dev server, no database, no network beyond the
// optional rate fetch. Needs Chromium once: `npx playwright install chromium`.
//
// The PDF is written next to the config unless --out says otherwise. Configs
// and PDFs hold client billing details — keep both in the git-ignored
// invoices/ directory.

function parseArgs(argv: string[]): { configPath: string; outPath: string } {
  const args = [...argv];
  let out: string | undefined;
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1) {
    out = args[outIdx + 1];
    if (!out) throw new Error("--out needs a path");
    args.splice(outIdx, 2);
  }
  const configPath = args[0];
  if (!configPath || args.length > 1) {
    throw new Error(
      "usage: npm run invoice -- <config>.yml [--out <path>.pdf]",
    );
  }
  return {
    configPath: resolve(configPath),
    outPath: resolve(out ?? configPath.replace(/\.ya?ml$/i, "") + ".pdf"),
  };
}

async function printToPdf(html: string): Promise<Buffer> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    // Shared detector with the magazine PDF generator (src/lib/chromium.ts);
    // the error carries the original launch failure alongside the hint.
    if (isMissingBrowser(err)) throw new ChromiumUnavailableError(err);
    throw err;
  }
  try {
    const page = await browser.newPage();
    // The document is fully self-contained (fonts inlined as data URIs), so
    // there is nothing to wait for on the network — only the font faces
    // decoding, so text prints in the real families, not a fallback.
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const { configPath, outPath } = parseArgs(process.argv.slice(2));
  const config = loadInvoiceConfig(configPath);
  const fx = await resolveFx(config);
  const totals = computeTotals(config, fx);
  const pdf = await printToPdf(renderInvoiceHtml(config, totals, fx));
  writeFileSync(outPath, pdf);

  const total = (totals.totalCents / 100).toFixed(2);
  console.log(`${config.invoice.number} — total ${total} ${config.currency}`);
  console.log(`wrote ${outPath}`);
  if (fx && !fx.pinned) {
    // A live rate makes this generation unrepeatable — say so, loudly, with
    // the exact lines to paste so pinning is a copy, not a chore.
    console.log(
      `\nRate fetched live (1 ${fx.from} = ${fx.rate} ${fx.to}, ECB ${fx.date}).\n` +
        `Pin it in the config so regenerating never changes amounts:\n\n` +
        `fxRate: ${fx.rate}\n` +
        `fxDate: ${fx.date}\n` +
        `fxFrom: ${fx.from}\n`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
