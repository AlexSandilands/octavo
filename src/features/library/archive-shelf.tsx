import { ListPagination } from "@/components/list-pagination";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { PagedList } from "@/lib/pagination";
import type { SponsorMap } from "@/lib/sponsors";
import type { IssueRow } from "@/server/issues";
import { ArchiveGrid, toArchiveItems } from "./archive-grid";
import { ArchiveSearch } from "./archive-search";
import { ArchiveYearFilter } from "./archive-year-filter";

// One served page of the full archive: the search and year filter above the
// shelf, the covers themselves, and the page control below. Everything that
// narrows or pages the list is server-side and lives in the URL — this
// component only lays the three out, so a refresh or a shared link rebuilds
// exactly the view someone was looking at.
export function ArchiveShelf({
  list,
  query,
  year,
  years,
  images,
  sponsors,
  settings,
}: {
  list: PagedList<IssueRow>;
  query: string;
  year: number | null;
  years: number[];
  images: ImageMap;
  sponsors: SponsorMap;
  settings: SiteSettings;
}) {
  const { matching } = list;
  const issues = matching === 1 ? "issue" : "issues";
  const from = year ? ` from ${year}` : "";

  // The outcome of the search + filter in one sentence for the live region
  // below — built only from the query, the year and the whole-list match
  // count, so turning a page leaves it byte-identical and the region stays
  // silent (the page control announces its own turn).
  const resultMessage =
    matching === 0
      ? query
        ? `No issues${from} match “${query}”.`
        : year
          ? `No issues published in ${year}.`
          : "No issues published yet."
      : query
        ? `${matching} ${issues}${from} ${matching === 1 ? "matches" : "match"} “${query}”.`
        : `Showing ${matching} ${issues}${from}.`;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <ArchiveSearch query={query} />
        </div>
        <ArchiveYearFilter year={year} years={years} />
      </div>

      {/* Mounted whatever the outcome — a region that arrives together with
          its text is announced unreliably, and someone searching for an issue
          that isn't there needs to hear the nothing. Visible only when the
          shelf is empty, where it is also the empty state. */}
      <p
        role="status"
        aria-live="polite"
        className={
          list.rows.length === 0
            ? "text-faint py-16 text-center font-sans text-[15px]"
            : "sr-only"
        }
      >
        {resultMessage}
      </p>

      {list.rows.length > 0 && (
        <div className="mt-8">
          <ArchiveGrid
            items={toArchiveItems(list.rows)}
            images={images}
            sponsors={sponsors}
            settings={settings}
            heading={null}
          />
        </div>
      )}

      <ListPagination
        page={list.page}
        pageCount={list.pageCount}
        label="Archive pages"
      />
    </div>
  );
}
