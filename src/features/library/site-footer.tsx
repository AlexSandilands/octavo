// A quiet close to the library pages: who publishes it, how many issues exist
// and since when. The way out (Sign out) lives in the shell and on the
// Account page, so nothing here is a control.
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
    <footer className="text-fg-muted mt-10 flex flex-col gap-1 pb-4 font-ui text-[14px] sm:flex-row sm:items-center sm:justify-between">
      <div className="font-bold">{org}</div>
      <div>
        {issueCount} {issueCount === 1 ? "issue" : "issues"}
        {estYear ? ` · Est. ${estYear}` : ""}
      </div>
    </footer>
  );
}
