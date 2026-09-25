import { formatAverage, formatCount } from "./format";

// The plain-language paragraph under the figures (#314): what a request cost
// on average in the month shown, who pays, and how to get more.
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
  const when = current ? "This month" : `In ${monthName}`;
  return (
    <div className="text-body max-w-[64ch] space-y-3 font-sans text-[15px] leading-relaxed">
      <p>
        {requests === 0 ? (
          <>
            {current
              ? "This month the assistant hasn’t been used yet."
              : `In ${monthName} the assistant wasn’t used.`}
          </>
        ) : (
          <>
            {when} the assistant answered {formatCount(runs)}{" "}
            {runs === 1 ? "message" : "messages"}, which took{" "}
            {formatCount(requests)} {requests === 1 ? "request" : "requests"} to
            the AI provider &mdash; about{" "}
            <strong>{formatAverage(spent / requests)}</strong> a request.
          </>
        )}{" "}
        A <em>run</em> is one message sent to the assistant and everything it
        does in answer. <em>Cached reads</em> are the parts of a conversation
        the provider has already been sent; they cost a small fraction of the
        normal rate, which is most of why the assistant is cheap.
      </p>
      <p>
        The provider&rsquo;s bill is paid by whoever looks after the site for
        the club and passed on at cost, with no mark-up. When a month&rsquo;s
        allowance is used up, the assistant stops until the next month begins.
        To raise the allowance, or to top up a busy month, ask them: it&rsquo;s
        a change on their side, not a setting here.
      </p>
    </div>
  );
}
