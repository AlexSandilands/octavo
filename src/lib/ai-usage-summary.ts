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
});
export type AiUsageSummary = z.infer<typeof aiUsageSummarySchema>;

const usd = (n: number, cents: boolean) =>
  `$${cents || !Number.isInteger(n) ? n.toFixed(2) : n.toString()}`;

/** "$1.20 of $20 used this month". */
export function usageLine({ spent, allowance, granted }: AiUsageSummary) {
  return `${usd(spent, true)} of ${usd(allowance + granted, false)} used this month`;
}
