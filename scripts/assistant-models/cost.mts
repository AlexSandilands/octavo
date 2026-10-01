// What a run will cost, said before it starts (#315). Each case carries the
// tokens one run took on Sonnet 5 in the spike; priced at the model's list
// rates with a margin, times the repeats. The ceiling is the per-run cap: no
// case run can spend more than $0.50, whatever the model does.
import { createInterface } from "node:readline/promises";
import { priceFor, RUN_SPEND_CAP_USD } from "../../src/lib/ai-pricing.ts";
import type { Case } from "../fixtures/assistant/cases.mts";

/** Models differ in how many calls a case takes (Haiku thrashed 80 on one). */
const MARGIN = 1.5;

export type Estimate = { usd: number; ceilingUsd: number; runs: number };

export function estimate(
  model: string,
  cases: Case[],
  repeat: number,
): Estimate {
  const price = priceFor(model);
  if (!price)
    throw new Error(
      `"${model}" has no price in src/lib/ai-pricing.ts; add it (dated) first.`,
    );
  const perRun = cases.reduce(
    (sum, c) =>
      sum +
      (c.estimate.input * price.inputPerMillion +
        c.estimate.cacheRead * price.cacheReadPerMillion +
        c.estimate.cacheWrite * price.cacheWritePerMillion +
        c.estimate.output * price.outputPerMillion) /
        1_000_000,
    0,
  );
  const runs = cases.length * repeat;
  return {
    usd: perRun * repeat * MARGIN,
    ceilingUsd: runs * RUN_SPEND_CAP_USD,
    runs,
  };
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export function describeEstimate(model: string, e: Estimate): string {
  return `${model}: ${e.runs} case runs, about ${usd(e.usd)} (at most ${usd(e.ceilingUsd)}, the $0.50 per-run cap)`;
}

/** Ask before spending; `yes` skips the question. Refuses without a TTY. */
export async function confirmSpend(
  text: string,
  yes: boolean,
): Promise<boolean> {
  console.log(`\nThis spends real money. ${text}`);
  if (yes) return true;
  if (!process.stdin.isTTY) {
    console.log("No terminal to ask on; pass --yes to agree up front.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Go ahead? [y/N] ");
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
