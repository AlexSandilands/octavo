import { z } from "zod";
import { ListFilter } from "@/components/list-filter";
import { UsageFigures } from "@/features/ai-usage/usage-figures";
import { UsageNotes } from "@/features/ai-usage/usage-notes";
import { UsageTable } from "@/features/ai-usage/usage-table";
import {
  monthLabel,
  monthParamSchema,
  monthStart,
  monthsBetween,
} from "@/lib/ai-month";
import { isAssistantEnabled } from "@/lib/ai";
import { monthOf, resolveBudget, usageByDay } from "@/server/ai-budget";
import { firstLedgerMonth, monthRuns } from "@/server/ai-usage";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// Assistant usage (#314): the month's spend against its allowance, and the
// month day by day. Read-only — the allowance and top-ups are made outside the
// app. `?month=YYYY-MM` picks a month, like the admin lists' URL state; a
// malformed month, or one outside the ledger's life, reads as this one.
const paramsSchema = z.object({ month: monthParamSchema });

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout gates too, but layouts don't re-run on soft navigation.
  await requireAdminOrRedirect();
  const now = new Date();
  const thisMonth = monthOf(now);
  const asked = paramsSchema.parse(await searchParams).month;
  // The picker runs from the ledger's first month, and so does ?month= — an
  // unbounded one (a typo'd 0026-09) would list thousands of months.
  const earliest = [
    (await firstLedgerMonth()) ?? thisMonth,
    thisMonth,
  ].sort()[0]!;
  const month =
    asked && asked >= earliest && asked <= thisMonth ? asked : thisMonth;
  const current = month === thisMonth;

  const [budget, days, runs] = await Promise.all([
    resolveBudget(monthStart(month)),
    usageByDay(month),
    monthRuns(month),
  ]);
  const months = monthsBetween(earliest, thisMonth);
  const monthName = monthLabel(month);
  const rows = days
    .map((d) => ({
      day: d.day,
      requests: d.requests,
      runs: d.runs,
      tokens: d.tokens,
      cost: d.cost,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
  const requests = rows.reduce((n, r) => n + r.requests, 0);
  const enabled = isAssistantEnabled();

  return (
    <div className="max-w-[880px] pb-16">
      <h1 className="text-ink font-serif text-3xl">Assistant usage</h1>
      <p className="text-faint mt-1.5 font-sans text-sm">
        What the editing assistant has cost, month by month. The allowance is
        set outside the site, so this page only reports it.
      </p>
      {!enabled && (
        <p className="bg-warn-soft text-warn-strong mt-5 rounded-[10px] px-4 py-3 font-sans text-[15px]">
          The assistant is not enabled on this site.
        </p>
      )}

      <section aria-labelledby="usage-month" className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="usage-month" className="text-ink font-serif text-[22px]">
            {monthName}
          </h2>
          <div className="sm:w-auto">
            <ListFilter
              label="Month"
              ariaLabel="Show a month's usage"
              param="month"
              value={month}
              defaultValue={thisMonth}
              options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            />
          </div>
        </div>
        <div className="mt-4">
          <UsageFigures budget={budget} current={current} />
        </div>
        <div className="mt-6">
          <UsageNotes
            requests={requests}
            runs={runs}
            spent={budget.spent}
            monthName={monthName}
            current={current}
          />
        </div>
      </section>

      <section aria-labelledby="usage-days" className="mt-10">
        <h2
          id="usage-days"
          className="text-ink mb-4 font-serif text-[22px] leading-tight"
        >
          Day by day
        </h2>
        <UsageTable
          rows={rows}
          runs={runs}
          monthName={monthName}
          current={current}
        />
      </section>
    </div>
  );
}
