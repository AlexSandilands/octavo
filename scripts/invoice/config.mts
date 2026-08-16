import { readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";
import { z } from "zod";

// The invoice config schema — the "data" half of the tool's template + data
// split (issue #187). Every invoice is one YAML file matching this shape; the
// committed `invoice.example.yml` documents it with fake values. Real configs
// hold client billing details, so they live in the git-ignored `invoices/`
// directory. All input is zod-validated at the boundary (design-principles
// §4) — a YAML file is external input like any other.

// Calendar dates as written in the config (YYYY-MM-DD), checked to be real
// days — `2026-02-30` round-trips through Date to a different ISO string and
// is refused rather than silently rendered as March 2nd.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine(
    (s) => new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s,
    "not a real calendar date",
  );

// Money as entered: a non-negative number with at most 2 decimal places. All
// arithmetic downstream happens in integer cents (totals.mts), so the only
// float ever trusted is the one the author typed.
const money = z
  .number()
  .finite()
  .nonnegative()
  .refine(
    (v) => Number(v.toFixed(2)) === v,
    "amounts must have at most 2 decimal places",
  );

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "expected a 3-letter currency code (e.g. NZD, USD)");

// Free-text lines (contact details, bank details) — rendered one per row.
const lines = z.array(z.string().min(1)).min(1);

const item = z.object({
  description: z.string().min(1),
  // Unit price in the item's native currency; foreign items are converted to
  // the invoice currency per line, with the original shown alongside.
  amount: money,
  currency: currencyCode.optional(),
  qty: z.number().finite().positive().default(1),
  // Label for the unit the qty counts (e.g. "month") — display only.
  unit: z.string().min(1).optional(),
});

export const invoiceConfigSchema = z
  .object({
    invoice: z.object({
      number: z.string().min(1),
      // Document title, e.g. "Statement" for an information-only document.
      title: z.string().min(1).default("Invoice"),
      issueDate: isoDate,
      // Optional so a statement can carry no due date — omitting it drops the
      // DUE box, the "Due by" line, and relabels the total from "Total due".
      dueDate: isoDate.optional(),
      // Billing period rendered under the title (e.g. "May – August 2026").
      period: z.string().min(1).optional(),
    }),
    issuer: z.object({
      name: z.string().min(1),
      contact: lines,
      // Bank / payment detail lines, rendered in the payment block.
      payment: lines,
    }),
    client: z.object({
      name: z.string().min(1),
      contact: lines.optional(),
    }),
    currency: currencyCode.default("NZD"),
    // Pinned exchange rate: 1 fxFrom = fxRate units of the invoice currency,
    // as of fxDate. Present → overrides the live fetch, making the invoice
    // reproducible; absent → fx.mts fetches today's ECB rate and the tool
    // prints the trio to paste in. Always all three or none: the footer
    // states the rate's date, so a rate without one is meaningless, and a
    // rate without its currency (fxFrom) could silently convert the wrong
    // currency when a config is copied for the next invoice.
    fxRate: z.number().finite().positive().optional(),
    fxDate: isoDate.optional(),
    fxFrom: currencyCode.optional(),
    items: z.array(item).min(1),
    // GST is optional and off by default — the issuer is not GST-registered.
    // The field exists so registering later is a config edit, not a template
    // change. Rate in percent (15, not 0.15).
    gst: z
      .object({
        rate: z.number().finite().positive().max(100),
        label: z.string().min(1).optional(),
      })
      .optional(),
    // A prominent banner under the billed-to band — e.g. "For information
    // only — no payment due now." on a statement.
    notice: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
  })
  .refine(
    (c) =>
      (c.fxRate === undefined) === (c.fxDate === undefined) &&
      (c.fxRate === undefined) === (c.fxFrom === undefined),
    { message: "fxRate, fxDate and fxFrom must be set together" },
  )
  // The pin must describe the conversion actually on the page: a pin for a
  // currency no item uses (foreign line deleted, config copied for a
  // different client) would otherwise go silently unapplied — or worse, get
  // applied to a different currency under a confident footer.
  .refine(
    (c) =>
      c.fxFrom === undefined ||
      (c.fxFrom !== c.currency &&
        c.items.some((i) => (i.currency ?? c.currency) === c.fxFrom)),
    {
      message:
        "fxFrom must name the foreign currency the line items actually use — " +
        "a pin for any other currency would not describe the conversion on " +
        "the invoice",
    },
  )
  .refine(
    (c) =>
      new Set(
        c.items
          .map((i) => i.currency ?? c.currency)
          .filter((cur) => cur !== c.currency),
      ).size <= 1,
    {
      message:
        "items may use at most one foreign currency per invoice — " +
        "a single fxRate must describe every conversion on the page",
    },
  );

export type InvoiceConfig = z.infer<typeof invoiceConfigSchema>;
export type InvoiceItem = InvoiceConfig["items"][number];

// The one foreign currency the invoice converts from, if any item uses one.
export function foreignCurrency(config: InvoiceConfig): string | null {
  for (const it of config.items) {
    const cur = it.currency ?? config.currency;
    if (cur !== config.currency) return cur;
  }
  return null;
}

export function loadInvoiceConfig(path: string): InvoiceConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`cannot read config file: ${path}`);
  }
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${path} is not valid YAML:\n${msg}`);
  }
  const parsed = invoiceConfigSchema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${path} failed validation:\n${details}`);
  }
  return parsed.data;
}
