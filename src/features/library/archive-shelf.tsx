import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { PagedList } from "@/lib/pagination";
import type { SponsorMap } from "@/lib/sponsors";
import type { IssueRow } from "@/server/issues";
import { ArchiveGrid, toArchiveItems } from "./archive-grid";
import { ARCHIVE_QUERY_MAX } from "./archive-limits";
import { archiveResultMessage } from "./archive-message";
import { ArchiveYearFilter } from "./archive-year-filter";

// One served page of the full archive: the search and year chips above the
// cards, the cards themselves, and the page control below. Everything that
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
    <div className="mt-5">
      <div className="bg-surface border-hairline shadow-card flex flex-col gap-3 rounded-card border p-3 sm:p-4">
        <ListSearch
          query={query}
          placeholder="Search issues by title"
          ariaLabel="Search every issue by title"
          maxLength={ARCHIVE_QUERY_MAX}
        />
        <ArchiveYearFilter year={year} years={years} query={query} />
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
            ? "text-fg-muted bg-surface border-hairline mt-5 rounded-card border px-6 py-14 text-center font-ui text-[17px]"
            : "sr-only"
        }
      >
        {resultMessage}
      </p>

      {list.rows.length > 0 && (
        <div className="mt-6">
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
        labels={{ previous: "Newer", next: "Older" }}
      />
    </div>
  );
}
