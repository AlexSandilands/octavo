"use client";

import {
  ADMIN_LIST_ROWS,
  ADMIN_LIST_TABLE,
  ADMIN_LIST_TOOLBAR,
} from "@/components/admin-list-layout";
import { TableHead, ZEBRA } from "@/components/admin-table";
import { ListFilter, type ListFilterOption } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import { SPONSOR_COLS, SponsorRow } from "./sponsor-row";
import type {
  SponsorFilter,
  SponsorList,
  SponsorListItem,
} from "@/lib/sponsors";

const FILTERS: ListFilterOption<SponsorFilter>[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

// One served page of an already-narrowed list — the search, the filter and the
// paging all happen server-side (see ListSearch / ListFilter / ListPagination).
// No selection here: sponsors are edited and removed one at a time.
export function SponsorsTable({
  list,
  query,
  filter,
  onEdit,
  onChanged,
}: {
  list: SponsorList;
  query: string;
  filter: SponsorFilter;
  onEdit: (sponsor: SponsorListItem) => void;
  onChanged: () => void;
}) {
  const searching = query.length > 0;
  const matching = list.matching;

  // What the current view is a list *of*, so a filter change reads as one
  // sentence rather than repeating the last and going unheard.
  const noun =
    filter === "active"
      ? "active sponsor"
      : filter === "expired"
        ? "expired sponsor"
        : "sponsor";
  const nouns = `${noun}s`;

  const resultMessage =
    matching === 0
      ? searching
        ? `No ${nouns} match “${query}”.`
        : `No ${nouns} to show.`
      : searching
        ? `${matching} ${matching === 1 ? `${noun} matches` : `${nouns} match`} “${query}”.`
        : `Showing ${matching} ${matching === 1 ? noun : nouns}.`;

  return (
    // Pinned filters over scrolling rows from md up, a sticky search row on a
    // phone — see admin-list-layout.ts for the layers.
    <div className={ADMIN_LIST_TABLE}>
      <div className={`${ADMIN_LIST_TOOLBAR} lg:items-end`}>
        <div className="min-w-0 flex-1">
          <ListSearch
            query={query}
            placeholder="Search by name"
            ariaLabel="Search all sponsors by name"
            label="Search sponsors"
          />
        </div>
        <ListFilter
          label="Filter"
          ariaLabel="Filter sponsors"
          param="filter"
          value={filter}
          options={FILTERS}
        />
      </div>

      {list.rows.length > 0 && (
        <TableHead>
          <span className="flex-1">Sponsor</span>
          <span className={SPONSOR_COLS.link}>Link</span>
          <span className={SPONSOR_COLS.until}>Active until</span>
          <span className={`text-right ${SPONSOR_COLS.actions}`}>Actions</span>
        </TableHead>
      )}

      <div className={ADMIN_LIST_ROWS}>
        <div className={ZEBRA}>
          {list.rows.map((s) => (
            <SponsorRow
              key={s.id}
              sponsor={s}
              onEdit={() => onEdit(s)}
              onChanged={onChanged}
            />
          ))}
        </div>

        {/* The result of the search / filter, live. Mounted whatever the outcome
          — a region that arrives together with its text is announced
          unreliably. Visible only when there are no rows, where it is also the
          empty state; otherwise the rows are the sighted answer. */}
        <p
          role="status"
          aria-live="polite"
          className={
            list.rows.length === 0
              ? "border-lead rule-heavy text-grey mt-4 border px-6 py-10 text-center font-ui text-[17px]"
              : "sr-only"
          }
        >
          {resultMessage}
        </p>

        <ListPagination
          page={list.page}
          pageCount={list.pageCount}
          label="Sponsor list pages"
          noun="sponsors"
        />
      </div>
    </div>
  );
}
