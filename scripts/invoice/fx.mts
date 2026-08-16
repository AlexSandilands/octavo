import { z } from "zod";
import { foreignCurrency, type InvoiceConfig } from "./config.mts";

// Exchange-rate resolution (issue #187). An invoice with foreign-currency
// items needs exactly one rate; where it comes from is a two-step story:
//
// 1. A fresh invoice fetches the live ECB reference rate from frankfurter.app
//    (no key, no signup) — a convenience for the first generation only.
// 2. The author then PINS that rate in the config (`fxRate:` + `fxDate:`),
//    because an invoice must be reproducible: regenerating next month must not
//    silently change amounts. A pinned rate always wins; the tool never
//    fetches when one is present.
//
// Either way the footer states the rate and its date, so the conversion is
// transparent to the client reading the page.

export type FxResolution = {
  rate: number;
  date: string;
  from: string;
  to: string;
  // Whether the rate came from the config (pinned) or the live fetch — the
  // CLI uses this to nag about pinning after a live generation.
  pinned: boolean;
};

// The slice of frankfurter's response we rely on — validated like any other
// external input (design-principles §4).
const frankfurterResponse = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.number().finite().positive()),
});

async function fetchEcbRate(
  from: string,
  to: string,
): Promise<{ rate: number; date: string }> {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `could not reach frankfurter.app for the ${from}→${to} rate (${msg}). ` +
        `Set fxRate/fxDate in the config to generate offline.`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `frankfurter.app returned ${res.status} for ${from}→${to}. ` +
        `Set fxRate/fxDate in the config to generate offline.`,
    );
  }
  const parsed = frankfurterResponse.safeParse(await res.json());
  const rate = parsed.success ? parsed.data.rates[to] : undefined;
  if (!parsed.success || rate === undefined) {
    throw new Error(
      `frankfurter.app response did not carry a ${from}→${to} rate — ` +
        `refusing to guess. Set fxRate/fxDate in the config instead.`,
    );
  }
  return { rate, date: parsed.data.date };
}

// Resolve the rate the invoice will convert with, or null when every item is
// already in the invoice currency (no fetch, no rate, no footer line).
export async function resolveFx(
  config: InvoiceConfig,
): Promise<FxResolution | null> {
  const from = foreignCurrency(config);
  if (!from) return null;
  const to = config.currency;
  if (config.fxRate !== undefined && config.fxDate !== undefined) {
    // The schema proved fxFrom === the one foreign currency in use, so the
    // pin is known to describe this conversion; keep a guard for the
    // impossible case anyway.
    if (config.fxFrom !== from) {
      throw new Error(`fx pin is for ${config.fxFrom}, items use ${from}`);
    }
    return { rate: config.fxRate, date: config.fxDate, from, to, pinned: true };
  }
  const live = await fetchEcbRate(from, to);
  return { ...live, from, to, pinned: false };
}
