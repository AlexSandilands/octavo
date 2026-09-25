import Link from "next/link";
import { P } from "./guide-ui";

// "Where to see what it costs" (#314), mounted last in the Assistant section.
// Self-contained so the section's own text (#309) composes around it.
export function AssistantUsageHelp() {
  return (
    <>
      <h3 className="text-ink font-sans text-[15.5px] font-semibold">
        Where to see what it costs
      </h3>
      <P>
        <Link
          href="/admin/ai"
          className="text-accent hover:text-accent-strong font-medium underline"
        >
          Assistant usage
        </Link>{" "}
        &mdash; linked from <strong>Magazine details</strong> and from the foot
        of the assistant&rsquo;s panel &mdash; shows what this month has cost so
        far, what&rsquo;s left of the month&rsquo;s allowance, and a day-by-day
        table. Choose a month at the top of the page to look back.
      </P>
      <P>
        The allowance is set by whoever looks after the site for the club, who
        pays the bill and passes it on at cost. Nothing on the page changes it.
        If the allowance runs out, the assistant stops until the next month
        begins; to raise it, or to top up a busy month, ask them.
      </P>
    </>
  );
}
