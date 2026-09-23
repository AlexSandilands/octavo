"use client";

import { useEffect, useRef, useState } from "react";
import {
  ADMIN_LIST_ROWS,
  ADMIN_LIST_TABLE,
  ADMIN_LIST_TOOLBAR,
} from "@/components/admin-list-layout";
import { ListFilter, type ListFilterOption } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import type { ReportFilter } from "@/lib/comments";
import type { ReportList } from "@/server/report-inbox";
import { ReportRow } from "./report-row";

const FILTERS: ListFilterOption<ReportFilter>[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const NOUNS: Record<ReportFilter, string> = {
  open: "open report",
  resolved: "resolved report",
  all: "report",
};

// One served page of the inbox. The search, the filter and the paging run on
// the server; the row actions revalidate it. A row that leaves the view (a
// resolve under the Open filter) takes focus with it, so the rows region takes
// it back and the outcome is announced here, where it outlives the row.
export function ReportsTable({
  list,
  query,
  filter,
}: {
  list: ReportList;
  query: string;
  filter: ReportFilter;
}) {
  const rowsRef = useRef<HTMLDivElement>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  // A new search, filter or page is a new question; the last action's outcome
  // doesn't belong in its answer.
  const view = `${query}\u0000${filter}\u0000${list.page}`;
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    setOutcome(null);
  }

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      if (outcome) rowsRef.current?.focus();
    }
  }, [list, outcome]);

  const noun = NOUNS[filter];
  const nouns = `${noun}s`;
  const matching = list.matching;
  const searching = query.length > 0;
  const resultMessage =
    matching === 0
      ? searching
        ? `No ${nouns} match “${query}”.`
        : `No ${nouns} to show.`
      : searching
        ? `${matching} ${matching === 1 ? `${noun} matches` : `${nouns} match`} “${query}”.`
        : `Showing ${matching} ${matching === 1 ? noun : nouns}.`;

  return (
    <div className={ADMIN_LIST_TABLE}>
      <div className={ADMIN_LIST_TOOLBAR}>
        <div className="min-w-0 flex-1">
          <ListSearch
            query={query}
            placeholder="Search comments, names and reporters"
            ariaLabel="Search all reports by comment, posting name or reporter"
          />
        </div>
        <ListFilter
          label="Show"
          ariaLabel="Filter reports by status"
          param="filter"
          value={filter}
          options={FILTERS}
          defaultValue="open"
        />
      </div>

      <div
        ref={rowsRef}
        tabIndex={-1}
        aria-label="Reports"
        role="region"
        className={`${ADMIN_LIST_ROWS} mt-2 outline-none`}
      >
        {list.rows.map((report) => (
          <ReportRow key={report.id} report={report} onDone={setOutcome} />
        ))}

        {/* Mounted whatever the outcome — a region that arrives with its text
            is announced unreliably. Visible only as the empty state. */}
        <p
          role="status"
          aria-live="polite"
          className={
            list.rows.length === 0
              ? "text-faint py-10 text-center font-sans text-sm"
              : "sr-only"
          }
        >
          {outcome ? `${outcome} ` : ""}
          {resultMessage}
        </p>

        <ListPagination
          page={list.page}
          pageCount={list.pageCount}
          label="Report list pages"
        />
      </div>
    </div>
  );
}
