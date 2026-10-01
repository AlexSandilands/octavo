import { formatCost, formatCount, formatDay, formatSpend } from "./format";

export type UsageDayRow = {
  /** "YYYY-MM-DD", UTC. */
  day: string;
  requests: number;
  runs: number;
  /** All four counts: input, cache writes, cache reads and output. */
  tokens: number;
  cost: number;
};

const NUM = "px-3 py-2.5 text-right tabular-nums";

// The month day by day, newest first (#314): only the days the assistant was
// used, with the month's totals at the foot. Plain table semantics, no chart —
// it reads better for this audience and needs no client code.
export function UsageTable({
  rows,
  runs,
  monthName,
  current,
}: {
  rows: UsageDayRow[];
  /** The month's runs counted once — a run can span two days. */
  runs: number;
  monthName: string;
  current: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-faint border-dash rounded-[10px] border border-dashed py-10 text-center font-sans text-sm">
        {current ? "No days to show yet this month." : "No days to show."}
      </p>
    );
  }
  const total = rows.reduce(
    (sum, r) => ({
      requests: sum.requests + r.requests,
      tokens: sum.tokens + r.tokens,
      cost: sum.cost + r.cost,
    }),
    { requests: 0, tokens: 0, cost: 0 },
  );
  return (
    // Focusable so a keyboard can scroll it sideways on a narrow screen.
    <div
      role="region"
      aria-label={`Use by day, ${monthName}`}
      tabIndex={0}
      className="bg-card border-line overflow-x-auto rounded-[10px] border"
    >
      <table className="text-body w-full min-w-[480px] font-sans text-[14px]">
        <caption className="sr-only">
          Assistant use by day in {monthName}, newest first, with the
          month&rsquo;s totals at the foot
        </caption>
        <thead className="text-faint border-line border-b text-[12px] font-semibold tracking-[0.08em] uppercase">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Day
            </th>
            <th scope="col" className={NUM}>
              Runs
            </th>
            <th scope="col" className={NUM}>
              Requests
            </th>
            <th scope="col" className={NUM}>
              Tokens
            </th>
            <th scope="col" className={NUM}>
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className="border-line-soft border-b">
              <th scope="row" className="px-3 py-2.5 text-left font-medium">
                {formatDay(r.day)}
              </th>
              <td className={NUM}>{formatCount(r.runs)}</td>
              <td className={NUM}>{formatCount(r.requests)}</td>
              <td className={NUM}>{formatCount(r.tokens)}</td>
              <td className={NUM}>{formatCost(r.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-ink font-semibold">
          <tr>
            <th scope="row" className="px-3 py-2.5 text-left">
              Month total
            </th>
            <td className={NUM}>{formatCount(runs)}</td>
            <td className={NUM}>{formatCount(total.requests)}</td>
            <td className={NUM}>{formatCount(total.tokens)}</td>
            <td className={NUM}>{formatSpend(total.cost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
