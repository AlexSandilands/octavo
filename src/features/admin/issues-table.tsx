"use client";

import { useMemo, useState } from "react";
import { matchingIssuesAction } from "@/app/admin/actions";
import {
  ADMIN_LIST_ROWS,
  ADMIN_LIST_TABLE,
  ADMIN_LIST_TOOLBAR,
} from "@/components/admin-list-layout";
import { ListFilter, type ListFilterOption } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import { IssueRow, type IssueRowData } from "./issue-row";
import { IssuesBulkBar } from "./issues-bulk-bar";
import { ISSUES_SELECTION_MAX } from "./selection-limit";
import type { IssueFilter, IssueStatus } from "@/server/issues";

const FILTERS: ListFilterOption<IssueFilter>[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
];

const ALL_YEARS = "all";

// The dashboard list: one served page of an already-narrowed set — the search,
// the status and year filters and the paging all happen server-side (see
// ListSearch / ListFilter / ListPagination); this component owns the selection.
export function IssuesTable({
  rows,
  page,
  pageCount,
  matching,
  query,
  filter,
  year,
  years,
}: {
  rows: IssueRowData[];
  page: number;
  pageCount: number;
  /** Every issue the search + filters match, across all pages. */
  matching: number;
  query: string;
  filter: IssueFilter;
  /** The active year filter — null when every year is showing. */
  year: number | null;
  /** The years that actually have published issues, newest first. */
  years: number[];
}) {
  // A map, not a set: the confirmation has to say how many of the selection are
  // published, and every id enters it from a row whose status is known — a
  // visible one, or one the select-all fetch named.
  const [selected, setSelected] = useState<ReadonlyMap<string, IssueStatus>>(
    new Map(),
  );

  const searching = query.length > 0;
  const filtering = filter !== "all" || year !== null;
  const paged = pageCount > 1;

  // Neither searching nor paging drops a selection — a row picked on one page
  // or under one query stays picked (and counted) when the current view hides
  // it, so a batch can be built across several pages and searches; the bar
  // names the unseen ones so the count is never a surprise. A selected row
  // deleted by another admin meanwhile is tolerated rather than tracked: the
  // bulk delete skips and reports ids that no longer exist.
  const selectedIds = useMemo(() => [...selected.keys()], [selected]);
  const publishedCount = useMemo(
    () => [...selected.values()].filter((s) => s === "published").length,
    [selected],
  );
  const shownIds = new Set(rows.map((r) => r.id));
  const hiddenSelectedCount = selectedIds.filter(
    (id) => !shownIds.has(id),
  ).length;

  const allShownSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someShownSelected = rows.some((r) => selected.has(r.id));

  const select = (id: string, next: boolean) =>
    setSelected((prev) => {
      const m = new Map(prev);
      const row = rows.find((r) => r.id === id);
      if (next && row) m.set(id, row.status);
      else m.delete(id);
      return m;
    });

  const selectAllShown = (next: boolean) =>
    setSelected((prev) => {
      const m = new Map(prev);
      for (const row of rows) {
        if (next) m.set(row.id, row.status);
        else m.delete(row.id);
      }
      return m;
    });

  // The bulk bar's "Select all N matching": the ids come from the server on
  // demand (the page payload carries only the served rows), scoped by the same
  // search + filters the list itself is narrowed by, and join whatever is
  // already selected. The merge stops at ISSUES_SELECTION_MAX — the bound the
  // bulk delete accepts — because the server's ids are capped but the selection
  // they join isn't; the bar says so whenever the cap is what ended the merge.
  const selectAllMatching = async () => {
    const res = await matchingIssuesAction({ query, filter, year });
    if (!res.ok) return false;
    setSelected((prev) => {
      const m = new Map(prev);
      for (const issue of res.issues) {
        if (m.size >= ISSUES_SELECTION_MAX && !m.has(issue.id)) continue;
        m.set(issue.id, issue.status);
      }
      return m;
    });
    return true;
  };

  // What the current view is a list *of* — so a filter change reads as one
  // ("No drafts match “spring”." after "No issues match “spring”.") instead of
  // producing the same sentence twice and going unheard.
  const noun =
    filter === "draft"
      ? "draft"
      : filter === "published"
        ? "published issue"
        : "issue";
  const nouns = `${noun}s`;
  const from = year !== null ? ` from ${year}` : "";

  const resultMessage =
    matching === 0
      ? searching
        ? `No ${nouns}${from} match “${query}”.`
        : `No ${nouns}${from} to show.`
      : searching
        ? `${matching} ${matching === 1 ? `${noun} matches` : `${nouns} match`} “${query}”${from}.`
        : `Showing ${matching} ${matching === 1 ? noun : nouns}${from}.`;

  const yearOptions: ListFilterOption<string>[] = [
    { value: ALL_YEARS, label: "All years" },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    // Pinned filters over scrolling rows from md up, a sticky search row on a
    // phone — see admin-list-layout.ts for the layers.
    <div className={ADMIN_LIST_TABLE}>
      <div className={ADMIN_LIST_TOOLBAR}>
        <div className="min-w-0 flex-1">
          <ListSearch
            query={query}
            placeholder="Search by title"
            ariaLabel="Search all issues by title"
          />
        </div>
        {/* Two filters on one line at phone width — stacking all three controls
            would push the first row off the screen. */}
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 lg:flex-none">
            <ListFilter
              label="Status"
              ariaLabel="Filter issues by status"
              param="filter"
              value={filter}
              options={FILTERS}
            />
          </div>
          <div className="min-w-0 flex-1 lg:flex-none">
            <ListFilter
              label="Year"
              ariaLabel="Filter issues by the year they were published"
              param="year"
              value={year === null ? ALL_YEARS : String(year)}
              options={yearOptions}
              defaultValue={ALL_YEARS}
            />
          </div>
        </div>
      </div>

      <IssuesBulkBar
        shownCount={rows.length}
        matching={matching}
        searching={searching}
        filtering={filtering}
        paged={paged}
        selectedIds={selectedIds}
        publishedCount={publishedCount}
        hiddenSelectedCount={hiddenSelectedCount}
        allShownSelected={allShownSelected}
        someShownSelected={someShownSelected}
        onToggleAllShown={selectAllShown}
        onSelectAllMatching={selectAllMatching}
        onClear={() => setSelected(new Map())}
      />

      <div className={`${ADMIN_LIST_ROWS} mt-2`}>
        {rows.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            selected={selected.has(issue.id)}
            onSelect={select}
          />
        ))}

        {/* The result of the search / filters, live. Mounted whatever the
          outcome — a region that arrives together with its text is announced
          unreliably, and an admin searching for an issue that isn't there needs
          to hear the nothing. Visible only when there are no rows, where it is
          also the empty state; otherwise the count is for screen readers, the
          rows themselves being the sighted answer. */}
        <p
          role="status"
          aria-live="polite"
          className={
            rows.length === 0
              ? "text-faint py-10 text-center font-sans text-sm"
              : "sr-only"
          }
        >
          {resultMessage}
        </p>

        <ListPagination
          page={page}
          pageCount={pageCount}
          label="Issue list pages"
        />
      </div>
    </div>
  );
}
