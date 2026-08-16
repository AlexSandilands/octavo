import type { InvoiceConfig, InvoiceItem } from "./config.mts";
import type { FxResolution } from "./fx.mts";

// The invoice arithmetic (issue #187), all in integer cents so no float
// artifact ever reaches the page. Per the handover: round per line with
// normal commercial rounding (half away from zero — Math.round on the
// non-negative values the schema guarantees), state everything to 2dp.

export type ComputedLine = {
  item: InvoiceItem;
  currency: string;
  // qty × unit amount, in the item's native currency.
  nativeCents: number;
  // The same total in the invoice currency — equal to nativeCents for
  // domestic lines, converted (and rounded per line) for foreign ones.
  invoiceCents: number;
  foreign: boolean;
};

export type ComputedTotals = {
  lines: ComputedLine[];
  subtotalCents: number;
  gstCents: number | null;
  totalCents: number;
};

// Exported so the template converts display amounts (the unit price column)
// with the same rule the arithmetic uses.
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function computeTotals(
  config: InvoiceConfig,
  fx: FxResolution | null,
): ComputedTotals {
  const lines = config.items.map((item): ComputedLine => {
    const currency = item.currency ?? config.currency;
    const foreign = currency !== config.currency;
    const nativeCents = Math.round(toCents(item.amount) * item.qty);
    if (foreign && !fx) {
      // resolveFx returns a rate whenever any item is foreign, so this is a
      // programming error, not a config error — fail loudly.
      throw new Error(`no exchange rate resolved for ${currency} line`);
    }
    const invoiceCents =
      foreign && fx ? Math.round(nativeCents * fx.rate) : nativeCents;
    return { item, currency, nativeCents, invoiceCents, foreign };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.invoiceCents, 0);
  const gstCents = config.gst
    ? Math.round((subtotalCents * config.gst.rate) / 100)
    : null;
  const totalCents = subtotalCents + (gstCents ?? 0);
  return { lines, subtotalCents, gstCents, totalCents };
}
