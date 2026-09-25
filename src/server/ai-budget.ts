import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiGrants, aiUsage } from "@/db/schema-ai";
import { priceUsage } from "@/lib/ai-pricing";
import { env } from "@/lib/env";

// The AI assistant's spend (issue #307): the ledger the proxy writes, the
// owner's grants, and the month's budget. A month is a calendar month in UTC,
// written "YYYY-MM". No UI and no model calls here.

export type Budget = {
  allowance: number;
  granted: number;
  spent: number;
  remaining: number;
  month: string;
};

export type UsageDay = {
  day: string; // "YYYY-MM-DD", UTC
  requests: number;
  runs: number;
  promptTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  completionTokens: number;
  tokens: number; // all four above
  cost: number;
};

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is written YYYY-MM.");

const tokenCount = z.number().int().nonnegative().max(2_000_000_000);

const usageSchema = z.object({
  userId: z.string().min(1).nullable(),
  issueId: z.string().min(1).nullable(),
  runId: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  provider: z.string().min(1).max(50),
  promptTokens: tokenCount,
  cacheReadTokens: tokenCount,
  cacheWriteTokens: tokenCount,
  completionTokens: tokenCount,
});
export type UsageInput = z.input<typeof usageSchema>;

// Whole dollars and cents only, as typed at the command line or passed in.
const grantSchema = z.object({
  amountUsd: z
    .union([z.number(), z.string()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "The amount is dollars with at most two decimals, e.g. 25.50.",
    })
    .transform(Number)
    .refine((value) => value > 0, { message: "The amount must be above $0." })
    .refine((value) => value <= 1000, {
      message: "The amount can be at most $1,000.",
    }),
  note: z.string().trim().min(1, "Say what the grant is for.").max(200),
});
export type GrantInput = z.input<typeof grantSchema>;

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export function monthOf(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function monthRange(month: string) {
  const [year, index] = monthSchema.parse(month).split("-").map(Number) as [
    number,
    number,
  ];
  return {
    start: new Date(Date.UTC(year, index - 1, 1)),
    end: new Date(Date.UTC(year, index, 1)),
  };
}

export async function resolveBudget(now = new Date()): Promise<Budget> {
  const month = monthOf(now);
  const { start, end } = monthRange(month);
  const [[grants], [usage]] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${aiGrants.amountUsd}), 0)`.mapWith(
          Number,
        ),
      })
      .from(aiGrants)
      .where(and(gte(aiGrants.createdAt, start), lt(aiGrants.createdAt, end))),
    db
      .select({
        total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)`.mapWith(
          Number,
        ),
      })
      .from(aiUsage)
      .where(and(gte(aiUsage.createdAt, start), lt(aiUsage.createdAt, end))),
  ]);
  const allowance = env.AI_MONTHLY_BUDGET_USD;
  const granted = grants?.total ?? 0;
  const spent = usage?.total ?? 0;
  return {
    allowance,
    granted,
    spent,
    remaining: Math.max(0, round6(allowance + granted - spent)),
    month,
  };
}

/** Prices one request and writes it to the ledger. Throws on a model with no
 *  price, so a new AI_MODEL can't run unmetered. */
export async function recordUsage(
  input: UsageInput,
): Promise<{ id: string; costUsd: number }> {
  const usage = usageSchema.parse(input);
  const costUsd = priceUsage(usage.model, usage);
  const [row] = await db
    .insert(aiUsage)
    .values({ ...usage, costUsd })
    .returning({ id: aiUsage.id });
  if (!row) throw new Error("The usage row was not written.");
  return { id: row.id, costUsd };
}

/** The run's spend so far, for the per-run cap (RUN_SPEND_CAP_USD). */
export async function runSpend(runId: string): Promise<number> {
  const id = z.string().min(1).parse(runId);
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)`.mapWith(Number),
    })
    .from(aiUsage)
    .where(eq(aiUsage.runId, id));
  return row?.total ?? 0;
}

/** The month's usage per UTC day, oldest first; days without usage are left
 *  out. */
export async function usageByDay(month: string): Promise<UsageDay[]> {
  const { start, end } = monthRange(month);
  const day = sql<string>`to_char(${aiUsage.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const total = (column: typeof aiUsage.promptTokens) =>
    sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);
  const rows = await db
    .select({
      day,
      requests: sql<number>`count(*)`.mapWith(Number),
      runs: sql<number>`count(distinct ${aiUsage.runId})`.mapWith(Number),
      promptTokens: total(aiUsage.promptTokens),
      cacheReadTokens: total(aiUsage.cacheReadTokens),
      cacheWriteTokens: total(aiUsage.cacheWriteTokens),
      completionTokens: total(aiUsage.completionTokens),
      cost: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)`.mapWith(Number),
    })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, start), lt(aiUsage.createdAt, end)))
    .groupBy(day)
    .orderBy(asc(day));
  return rows.map((row) => ({
    ...row,
    tokens:
      row.promptTokens +
      row.cacheReadTokens +
      row.cacheWriteTokens +
      row.completionTokens,
  }));
}

/** Adds one of the owner's top-ups; `npm run ai:grant` is its only caller. */
export async function grantBudget(
  input: GrantInput,
): Promise<{ id: string; amountUsd: number }> {
  const grant = grantSchema.parse(input);
  const [row] = await db
    .insert(aiGrants)
    .values(grant)
    .returning({ id: aiGrants.id, amountUsd: aiGrants.amountUsd });
  if (!row) throw new Error("The grant was not written.");
  return row;
}
