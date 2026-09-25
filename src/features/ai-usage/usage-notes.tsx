import { formatCost, formatCount } from "./format";

// The plain-language paragraph under the figures (#314): what a message cost
// on average in the month shown, and what happens when the allowance runs out.
// A message is a run; sub-cent averages read "less than a cent", not "about".
export function UsageNotes({
  runs,
  spent,
  monthName,
  current,
}: {
  runs: number;
  spent: number;
  monthName: string;
  current: boolean;
}) {
  return (
    <p className="text-body max-w-[64ch] font-sans text-[15px] leading-relaxed">
      {runs === 0 ? (
        current ? (
          "The assistant hasn’t been used yet this month."
        ) : (
          `The assistant wasn’t used in ${monthName}.`
        )
      ) : (
        <>
          {current ? "This month" : `In ${monthName}`} the assistant answered{" "}
          {runs === 1 ? (
            <>
              1 message, costing <strong>{formatCost(spent)}</strong>.
            </>
          ) : (
            <>
              {formatCount(runs)} messages, {spent / runs >= 0.005 && "about "}
              <strong>{formatCost(spent / runs)}</strong> each.
            </>
          )}
        </>
      )}{" "}
      When the month&rsquo;s allowance is used up, the assistant stops until the
      next month; the site owner can raise it.
    </p>
  );
}
