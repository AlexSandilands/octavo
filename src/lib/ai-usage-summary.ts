import { z } from "zod";

// What `GET /api/admin/ai/usage` answers (#309; #314's page reads the same):
// the month's budget as `resolveBudget()` works it out, in US dollars.
export const AI_USAGE_PATH = "/api/admin/ai/usage";

export const aiUsageSummarySchema = z.object({
  month: z.string(),
  allowance: z.number(),
  granted: z.number(),
  spent: z.number(),
  remaining: z.number(),
  /** The model a long paste's cost is estimated on (#312). */
  model: z.string(),
});
export type AiUsageSummary = z.infer<typeof aiUsageSummarySchema>;

// US dollars, as the provider bills and /admin/ai shows them: "US$1.23" under
// en-NZ. Spend rounds up to the cent, so the panel never understates it.
const money = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "USD",
});
const spendUp = (usd: number) =>
  Math.ceil(Math.round(usd * 1_000_000) / 10_000) / 100;

/** A figure rounded up to the cent: "US$0.13". */
export const usdUp = (usd: number) => money.format(spendUp(usd));

/** "US$1.21 of US$20.00 used this month". */
export function usageLine({ spent, allowance, granted }: AiUsageSummary) {
  return `${money.format(spendUp(spent))} of ${money.format(allowance + granted)} used this month`;
}
