// Number formats for the usage page (#314). Spend is in US dollars (the
// provider bills in them), so the symbol says so — "US$1.23" under en-NZ.

const money = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const count = new Intl.NumberFormat("en-NZ");

const dayFormat = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatMoney(usd: number): string {
  return money.format(usd);
}

// The ledger prices to a millionth of a dollar. Spend rounds up to the cent
// and what's left rounds down, so the page never understates spend and the
// three figures still add up to the allowance.
const hundredths = (usd: number) => Math.round(usd * 1_000_000) / 10_000;

export function formatSpend(usd: number): string {
  return money.format(Math.ceil(hundredths(usd)) / 100);
}

export function formatLeft(usd: number): string {
  return money.format(Math.floor(hundredths(usd)) / 100);
}

/** An average, where a fraction of a cent must not read as "US$0.00". */
export function formatAverage(usd: number): string {
  return usd > 0 && usd < 0.005 ? "less than a cent" : money.format(usd);
}

export function formatCount(n: number): string {
  return count.format(n);
}

/** "Thu, 24 Sep" from "2026-09-24" (a UTC calendar day). */
export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00.000Z`));
}
