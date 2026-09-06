// The colophon: a rule, then who publishes the magazine, how many issues exist
// and since when. Everything a member can do from here (preferences, signing
// out) already sits in the masthead, so the foot of the page only says who
// made it.
export function SiteFooter({
  org,
  issueCount,
  estYear,
}: {
  org: string;
  issueCount: number;
  estYear: number | null;
}) {
  return (
    <footer className="rule-heavy text-grey mt-6 flex flex-col gap-1 py-6 font-ui text-[15px] sm:flex-row sm:items-baseline sm:justify-between">
      <div className="text-lead font-display text-[17px]">{org}</div>
      <div className="tabular-nums">
        {issueCount} {issueCount === 1 ? "issue" : "issues"}
        {estYear ? ` · Est. ${estYear}` : ""}
      </div>
    </footer>
  );
}
