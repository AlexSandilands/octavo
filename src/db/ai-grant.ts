// Add a one-off top-up to this month's AI assistant budget (issue #307), then
// print the month as it now stands. Grants are the owner's, made only here.
//
// Run: npm run ai:grant -- 25 "Spring issue layout"
// Production (Railway): railway run npm run ai:grant -- 25 "Spring issue layout"
import { existsSync } from "node:fs";

// Load .env.local when present (local dev); in production the environment is
// set already. The app modules read it, so they load after.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const usd = (n: number) => `$${n.toFixed(2)}`;

async function main() {
  const [amount, note, ...rest] = process.argv.slice(2);
  if (amount === undefined || note === undefined || rest.length > 0) {
    throw new Error('Usage: npm run ai:grant -- <usd> "<note>"');
  }
  const { ZodError } = await import("zod");
  const { grantBudget, resolveBudget } = await import("@/server/ai-budget");
  try {
    const grant = await grantBudget({ amountUsd: amount, note });
    console.log(`Granted ${usd(grant.amountUsd)}.`);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(e.issues.map((issue) => issue.message).join("\n"));
    }
    throw e;
  }
  const b = await resolveBudget();
  console.log(
    `${b.month} (UTC): allowance ${usd(b.allowance)} + grants ${usd(b.granted)}` +
      ` − spent ${usd(b.spent)} = ${usd(b.remaining)} remaining.`,
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
