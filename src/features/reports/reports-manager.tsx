import { ADMIN_LIST_PAGE } from "@/components/admin-list-layout";
import { Icon } from "@/components/icons";
import type { ReportFilter } from "@/lib/comments";
import type { ReportList } from "@/server/report-inbox";
import { ReportsTable } from "./reports-table";

// The reports inbox page (issue #302): the heading with whole-inbox numbers,
// then the list — or, before anyone has reported anything, a quiet empty state.
export function ReportsManager({
  list,
  query,
  filter,
}: {
  list: ReportList;
  query: string;
  filter: ReportFilter;
}) {
  const summary =
    list.total === 0
      ? "No reports yet"
      : `${list.openTotal} open · ${list.total} in all`;

  return (
    // Pinned header and filters over scrolling rows from md up; see
    // admin-list-layout.ts.
    <div className={ADMIN_LIST_PAGE}>
      <div className="flex-none">
        <h1 className="text-ink font-serif text-3xl">Reports</h1>
        <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
      </div>

      {list.total === 0 ? (
        <div className="mt-8">
          <div className="bg-card border-line flex min-h-[320px] flex-col items-center justify-center rounded-md border p-9 text-center shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
            <div className="bg-tint text-accent flex h-[72px] w-[72px] items-center justify-center rounded-full">
              <Icon name="flag" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-ink mt-5 font-serif text-2xl">
              Nothing has been reported
            </h2>
            <p className="text-muted mt-2.5 max-w-sm font-sans text-[15px] leading-relaxed">
              When a member reports a comment in an issue&rsquo;s discussion, it
              arrives here with the comment exactly as they saw it, and every
              admin gets an email.
            </p>
          </div>
        </div>
      ) : (
        <ReportsTable list={list} query={query} filter={filter} />
      )}
    </div>
  );
}
