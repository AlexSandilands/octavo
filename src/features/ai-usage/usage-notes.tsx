import { formatCost, formatCount } from "./format";

// The plain-language paragraph under the figures (#314): what a request cost
// on average in the month shown, and what happens when the allowance runs out.
export function UsageNotes({
  requests,
  runs,
  spent,
  monthName,
  current,
}: {
  requests: number;
  runs: number;
  spent: number;
  monthName: string;
  current: boolean;
}) {
  return (
    <p className="text-body max-w-[64ch] font-sans text-[15px] leading-relaxed">
      {requests === 0 ? (
        current ? (
          "The assistant hasn’t been used yet this month."
        ) : (
          `The assistant wasn’t used in ${monthName}.`
        )
      ) : (
        <>
          {current ? "This month" : `In ${monthName}`} the assistant answered{" "}
          {formatCount(runs)} {runs === 1 ? "message" : "messages"}, about{" "}
          <strong>{formatCost(spent / requests)}</strong> a request.
        </>
      )}{" "}
      When the month&rsquo;s allowance is used up, the assistant stops until the
      next month; the site owner can raise it.
    </p>
  );
}
