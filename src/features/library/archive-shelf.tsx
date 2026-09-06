import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { PagedList } from "@/lib/pagination";
import type { SponsorMap } from "@/lib/sponsors";
import type { IssueRow } from "@/server/issues";
import { ArchiveGrid } from "./archive-grid";
import { ARCHIVE_QUERY_MAX } from "./archive-limits";
import { archiveResultMessage } from "./archive-message";
import { ArchiveYearFilter } from "./archive-year-filter";
import { toCoverItems } from "./cover-card";

// One served page of the full archive: the search and year filter above the
// shelves, the covers themselves, and the page control below. Everything that
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
  // The outcome of the search + filter in one sentence for the live region
  // below — built only from the query, the year and the whole-list match
  // count, so turning a page leaves it byte-identical and the region stays
  // silent (the page control announces its own turn).
  const resultMessage = archiveResultMessage({
    matching: list.matching,
    query,
    year,
  });

  return (
    <div className="mt-8">
      {/* Both controls print their names on the dark ground: the search as a
          label over the box, the year filter on its own trigger. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <ListSearch
            query={query}
            placeholder="Search issues by title"
            ariaLabel="Search every issue by title"
            maxLength={ARCHIVE_QUERY_MAX}
            visibleLabel="Search"
          />
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
            ? "text-chrome-muted py-20 text-center font-ui text-[16px]"
            : "sr-only"
        }
      >
        {resultMessage}
      </p>

      {list.rows.length > 0 && (
        <div className="mt-10">
          <ArchiveGrid
            items={toCoverItems(list.rows)}
            images={images}
            sponsors={sponsors}
            settings={settings}
          />
        </div>
      )}

      <ListPagination
        page={list.page}
        pageCount={list.pageCount}
        label="Archive pages"
        tone="dark"
      />
    </div>
  );
}
