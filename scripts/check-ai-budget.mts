// The AI budget module (issue #307), in-process against the local database:
// month resolution, grants, usage pricing (cache rates, dated and estimated
// ids, unknown models), per-run spend, the daily rollup and UTC boundaries.
// Every scratch row is dated 1999–2000, tagged "check-307", and removed again.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-budget.mts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// The allowance as env.ts parses it, in a child process so each value is fresh.
if (process.argv.includes("--env-probe")) {
  const { env } = await import("../src/lib/env.ts");
  try {
    console.log(JSON.stringify(env.AI_MONTHLY_BUDGET_USD));
  } catch {
    console.log('"refused"');
  }
  process.exit(0);
}
const allowanceFor = (value: string) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [...process.execArgv, fileURLToPath(import.meta.url), "--env-probe"],
      {
        env: { ...process.env, AI_MONTHLY_BUDGET_USD: value },
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .toString()
      .trim()
      .split("\n")
      .at(-1)!,
  ) as number | "refused";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
// A fixed allowance, and a local zone far from UTC so a boundary slip shows.
process.env.AI_MONTHLY_BUDGET_USD = "5";
process.env.TZ = "Pacific/Auckland";

const { eq, like } = await import("drizzle-orm");
const { db } = await import("../src/db/index.ts");
const { users } = await import("../src/db/schema.ts");
const { aiGrants, aiUsage } = await import("../src/db/schema-ai.ts");
const budget = await import("../src/server/ai-budget.ts");
const { priceFor } = await import("../src/lib/ai-pricing.ts");

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "ok" : "FAIL"} — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(72, "─"));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

const tag = `check-307-${randomUUID().slice(0, 8)}`;
const run = (name: string) => `${tag}-${name}`;
const at = (iso: string) => new Date(iso);
const zero = {
  promptTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  completionTokens: 0,
};

async function usage(
  runName: string,
  when: string,
  tokens: Partial<typeof zero>,
  extra: { model?: string; userId?: string | null } = {},
) {
  const row = await budget.recordUsage({
    userId: extra.userId ?? null,
    issueId: null,
    runId: run(runName),
    model: extra.model ?? "claude-sonnet-5",
    provider: "anthropic",
    ...zero,
    ...tokens,
  });
  await db
    .update(aiUsage)
    .set({ createdAt: at(when) })
    .where(eq(aiUsage.id, row.id));
  return row;
}

async function grant(amountUsd: number | string, when: string) {
  const row = await budget.grantBudget({ amountUsd, note: `${tag} grant` });
  await db
    .update(aiGrants)
    .set({ createdAt: at(when) })
    .where(eq(aiGrants.id, row.id));
  return row;
}

const scratchUserId = randomUUID();
try {
  heading("AI_MONTHLY_BUDGET_USD");
  for (const [value, want] of [
    ["", 0],
    ["50", 50],
    ["12.50", 12.5],
    ["10000", 10000],
    ["Infinity", "refused"],
    ["0x10", "refused"],
    ["-5", "refused"],
    ["1e3", "refused"],
    ["10000.01", "refused"],
  ] as const) {
    const got = allowanceFor(value);
    ok(got === want, `"${value}" reads as ${JSON.stringify(got)}`);
  }

  heading("an empty month");
  const empty = await budget.resolveBudget(at("1999-11-15T12:00:00Z"));
  ok(
    empty.month === "1999-11" &&
      empty.allowance === 5 &&
      empty.granted === 0 &&
      empty.spent === 0 &&
      empty.remaining === 5,
    `resolves to the allowance: ${JSON.stringify(empty)}`,
  );

  heading("grants");
  const g = await grant("2.50", "1999-12-31T23:59:59Z");
  ok(g.amountUsd === 2.5, "a grant is written with its amount");
  const dec = await budget.resolveBudget(at("1999-12-15T00:00:00Z"));
  ok(dec.granted === 2.5, "the grant counts in its month");
  ok(dec.remaining === 7.5, "and adds to the remaining budget");
  const jan = await budget.resolveBudget(at("2000-01-01T00:00:00Z"));
  ok(jan.granted === 0, "and not in the next");
  for (const [amount, why] of [
    [-5, "negative"],
    [0, "zero"],
    ["0.00", "zero with cents"],
    [1000.01, "over $1,000"],
    [5.123, "three decimals"],
    ["abc", "not a number"],
    ["1e3", "exponent notation"],
  ] as const) {
    const message = await throws(() =>
      budget.grantBudget({ amountUsd: amount, note: `${tag} refused` }),
    );
    ok(message !== null, `a grant is refused: ${why} (${amount})`);
  }
  ok(
    (await throws(() => budget.grantBudget({ amountUsd: 5, note: " " }))) !==
      null,
    "a grant is refused without a note",
  );
  ok(
    (await throws(() =>
      budget.grantBudget({ amountUsd: 5, note: "x".repeat(201) }),
    )) !== null,
    "a grant is refused with a note over 200 characters",
  );

  heading("pricing");
  const cached = await usage("cached", "1999-12-10T12:00:00Z", {
    promptTokens: 16,
    cacheReadTokens: 81_000,
    cacheWriteTokens: 2_000,
    completionTokens: 500,
  });
  // Sonnet 5: 16×$2 + 81,000×$0.20 + 2,000×$2.50 + 500×$10, per million.
  ok(
    close(cached.costUsd, 0.026232),
    `cached tokens are charged at the cache rates ($${cached.costUsd}, not $0.171032 at full input rate)`,
  );
  const haiku = await usage(
    "haiku",
    "1999-12-10T12:00:00Z",
    {
      promptTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      completionTokens: 1_000_000,
    },
    { model: "claude-haiku-4-5-20251001" },
  );
  ok(
    close(haiku.costUsd, 1 + 0.1 + 1.25 + 5),
    `a dated id prices as its base model ($${haiku.costUsd})`,
  );
  const [stored] = await db
    .select({ model: aiUsage.model })
    .from(aiUsage)
    .where(eq(aiUsage.id, haiku.id));
  ok(
    stored?.model === "claude-haiku-4-5-20251001",
    "the row keeps the id the provider reported",
  );
  ok(
    priceFor("claude-sonnet-5~") === priceFor("claude-sonnet-5") &&
      priceFor("claude-sonnet-5-20260101~") === priceFor("claude-sonnet-5"),
    "an estimated (~) id prices as its model",
  );
  ok(priceFor("fake")?.outputPerMillion === 0, "the fake provider costs $0");
  for (const model of [
    "claude-opus-5",
    "claude-sonnet-5-1",
    "claude-sonnet-5-2026",
    "claude-sonnet-5~~",
    "toString",
  ]) {
    const message = await throws(() =>
      budget.recordUsage({
        userId: null,
        issueId: null,
        runId: run("unknown"),
        model,
        provider: "anthropic",
        ...zero,
      }),
    );
    ok(
      message?.includes("No price"),
      `recordUsage on an unknown model throws (${model})`,
    );
  }
  const unknownRows = await db
    .select({ id: aiUsage.id })
    .from(aiUsage)
    .where(eq(aiUsage.runId, run("unknown")));
  ok(unknownRows.length === 0, "and writes nothing");
  ok(
    (await throws(() =>
      budget.recordUsage({
        userId: null,
        issueId: null,
        runId: run("bad"),
        model: "claude-sonnet-5",
        provider: "anthropic",
        ...zero,
        promptTokens: -1,
      }),
    )) !== null,
    "negative token counts are refused",
  );

  heading("usage against the month");
  const decSpent = cached.costUsd + haiku.costUsd;
  const decAfter = await budget.resolveBudget(at("1999-12-01T00:00:00Z"));
  ok(close(decAfter.spent, decSpent), `usage is spent ($${decAfter.spent})`);
  ok(
    close(decAfter.remaining, 5 + 2.5 - decSpent),
    `and subtracts from the remaining ($${decAfter.remaining})`,
  );
  await usage("big", "2000-02-10T00:00:00Z", { completionTokens: 1_000_000 });
  const feb = await budget.resolveBudget(at("2000-02-20T00:00:00Z"));
  ok(
    feb.spent === 10 && feb.remaining === 0,
    `remaining floors at 0 when spend passes the budget (${JSON.stringify(feb)})`,
  );

  heading("a removed member's usage still counts");
  await db
    .insert(users)
    .values({ id: scratchUserId, email: `${tag}@example.com` });
  await usage(
    "member",
    "1999-10-05T00:00:00Z",
    { completionTokens: 100_000 },
    { userId: scratchUserId },
  );
  await db.delete(users).where(eq(users.id, scratchUserId));
  const [orphan] = await db
    .select({ userId: aiUsage.userId })
    .from(aiUsage)
    .where(eq(aiUsage.runId, run("member")));
  ok(orphan && orphan.userId === null, "the row stays, its member cleared");
  const oct = await budget.resolveBudget(at("1999-10-20T00:00:00Z"));
  ok(oct.spent === 1, "and its spend stays in the month");

  heading("runSpend");
  await usage("a", "2000-01-10T00:00:00Z", { completionTokens: 10_000 });
  await usage("a", "2000-01-10T00:01:00Z", { promptTokens: 50_000 });
  await usage("b", "2000-01-10T00:02:00Z", { completionTokens: 30_000 });
  ok(
    close(await budget.runSpend(run("a")), 0.1 + 0.1),
    "sums only that run's requests",
  );
  ok(close(await budget.runSpend(run("b")), 0.3), "for each run");
  ok((await budget.runSpend(run("none"))) === 0, "an unknown run spent $0");

  heading("UTC month boundaries");
  // 23:30 UTC on 31 January is already 1 February in Auckland.
  await usage("edge", "2000-01-31T23:30:00Z", { completionTokens: 1_000 });
  await usage("edge", "2000-03-01T00:00:00Z", { completionTokens: 2_000 });
  const janAfter = await budget.resolveBudget(at("2000-01-31T23:59:59.999Z"));
  ok(janAfter.month === "2000-01", "the month is read in UTC");
  ok(
    close(janAfter.spent, 0.2 + 0.3 + 0.01),
    `the last half hour of January (UTC) counts in January ($${janAfter.spent})`,
  );
  const febAfter = await budget.resolveBudget(at("2000-02-01T00:00:00Z"));
  ok(
    febAfter.month === "2000-02" && febAfter.spent === 10,
    "February holds only its own usage",
  );
  const mar = await budget.resolveBudget(at("2000-03-01T00:00:00Z"));
  ok(close(mar.spent, 0.02), "midnight UTC on the 1st opens the next month");

  heading("usageByDay");
  const days = await budget.usageByDay("2000-01");
  ok(
    days.map((d) => d.day).join() === "2000-01-10,2000-01-31",
    `days with usage only, oldest first, in UTC (${days.map((d) => d.day)})`,
  );
  const [tenth] = days;
  ok(
    tenth?.requests === 3 &&
      tenth.runs === 2 &&
      tenth.promptTokens === 50_000 &&
      tenth.completionTokens === 40_000 &&
      tenth.tokens === 90_000 &&
      close(tenth.cost, 0.5),
    `a day's requests, runs, tokens and cost (${JSON.stringify(tenth)})`,
  );
  const decDays = await budget.usageByDay("1999-12");
  ok(
    decDays[0]?.cacheReadTokens === 1_081_000 &&
      decDays[0].cacheWriteTokens === 1_002_000 &&
      typeof decDays[0].cost === "number",
    "cache tokens are reported apart, as numbers",
  );
  ok(
    (await budget.usageByDay("1999-11")).length === 0,
    "an empty month has no days",
  );
  for (const month of ["2000-13", "2000-1", "January", "2000-01-01"]) {
    ok(
      (await throws(() => budget.usageByDay(month))) !== null,
      `a malformed month is refused (${month})`,
    );
  }
} finally {
  await db.delete(aiUsage).where(like(aiUsage.runId, `${tag}-%`));
  await db.delete(aiGrants).where(like(aiGrants.note, `${tag} %`));
  await db.delete(users).where(eq(users.id, scratchUserId));
}

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
