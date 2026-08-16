# Invoicing — the local invoice PDF generator

A repo-local CLI that turns a small YAML config into a client invoice PDF in the
octavo house style (heritage palette, the magazine's type families, the book
mark). Not a hosted feature: it runs on your machine, touches no database and no
dev server, and exists so billing a client is _copy a config, edit values, run
the tool_ (issue #187).

## Usage

```sh
# once, if Chromium isn't already installed for Playwright:
npx playwright install chromium

cp scripts/invoice/invoice.example.yml temp/invoices/INV-2026-001.yml
# …edit the config…
npm run invoice -- temp/invoices/INV-2026-001.yml          # writes …/INV-2026-001.pdf
npm run invoice -- temp/invoices/INV-2026-001.yml --out somewhere/else.pdf
```

**Never commit invoice data.** Configs and PDFs carry client billing details, so
they live in `temp/invoices/` (git-ignored). The only committed config is
`scripts/invoice/invoice.example.yml` — fake data, mirroring the `.env.example`
pattern — and it is the template to copy from. The schema's source of truth is
`scripts/invoice/config.mts` (zod, like every other external input).

## Currency conversion

Totals are stated in the invoice `currency:` (NZD). A line item may carry its
own native `currency:` (e.g. the USD subscriptions); those lines are converted
per line with normal commercial rounding, printed with the original amount
alongside, and the footer states the rate and its date.

The rate comes from one of two places:

- **Pinned** — `fxRate:` + `fxDate:` in the config. This is the normal state of
  a finished invoice: regenerating it must never silently change amounts.
- **Live** — with no pin, the tool fetches the current ECB reference rate from
  frankfurter.app (no key) and prints the two lines to paste into the config.
  Pin them before sending the invoice.

Only one foreign currency per invoice — one `fxRate` must describe every
conversion on the page; the schema enforces it.

## Conventions baked in

- **GST is off by default** (the issuer is not GST-registered). `gst: { rate: 15 }`
  turns it on later without touching the template — and only then does the
  subtotal/GST block render.
- Cadence is quarterly, in arrears: `qty: 3, unit: month` per monthly
  subscription, plus a ¼ share of each annual fee (domains) so a year's renewal
  is recovered across the four invoices that follow it. Numbering is sequential
  with year (`INV-2026-001`), the `period:` renders under the title.
- All arithmetic is integer cents; amounts validate to at most 2 decimal places.
- **Statements** (information-only documents) are the same config with
  `invoice.title: Statement`, no `dueDate` (the DUE box, "Due by" line and the
  "due" in "Total due" all drop), and a `notice:` banner — e.g. "For
  information only — no payment due now."

## How it renders

The tool builds one self-contained HTML document (fonts embedded as data URIs,
palette mirrored from the heritage `@theme` block in `globals.css`, the mark
from `src/lib/site-icon.tsx`) and prints it to A4 with headless Chromium — the
same render-HTML-then-print method as the magazine PDF (`src/lib/pdf.ts`), minus
the app. If the heritage identity ever changes, update the mirrored tokens in
`scripts/invoice/template.mts` alongside `globals.css`.
