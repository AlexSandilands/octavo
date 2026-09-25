import "server-only";
import { and, countDistinct, gte, lt, min } from "drizzle-orm";
import { db } from "@/db";
import { aiGrants, aiUsage } from "@/db/schema-ai";
import { monthOf } from "@/server/ai-budget";
import { monthStart, shiftMonth, type Month } from "@/lib/ai-month";

// What the usage page (#314) needs beyond the budget module: the month's runs
// counted once (a run across midnight UTC is in two days' rows), and the first
// month the ledger or a grant touched, where the month picker starts.

export async function monthRuns(month: Month): Promise<number> {
  const [row] = await db
    .select({ runs: countDistinct(aiUsage.runId) })
    .from(aiUsage)
    .where(
      and(
        gte(aiUsage.createdAt, monthStart(month)),
        lt(aiUsage.createdAt, monthStart(shiftMonth(month, 1))),
      ),
    );
  return row?.runs ?? 0;
}

export async function firstLedgerMonth(): Promise<Month | null> {
  const [[usage], [grant]] = await Promise.all([
    db.select({ at: min(aiUsage.createdAt) }).from(aiUsage),
    db.select({ at: min(aiGrants.createdAt) }).from(aiGrants),
  ]);
  const first = [usage?.at, grant?.at]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return first ? monthOf(first) : null;
}
