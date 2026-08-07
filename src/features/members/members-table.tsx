"use client";

import { useMemo, useState } from "react";
import { matchingMemberIdsAction } from "@/app/admin/members/actions";
import { MemberRow } from "./member-row";
import { MembersBulkBar } from "./members-bulk-bar";
import { MembersFilter } from "./members-filter";
import { MembersPagination } from "./members-pagination";
import { MembersSearch } from "./members-search";
import type { MemberFilter, MemberList } from "@/server/users";

// The table shows one served page of an already-narrowed list — the search,
// the status filter and the paging all happen server-side (see MembersSearch /
// MembersFilter / MembersPagination); this component owns only the selection.
export function MembersTable({
  list,
  query,
  filter,
  currentUserId,
}: {
  list: MemberList;
  query: string;
  filter: MemberFilter;
  currentUserId: string;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const shown = list.rows;
  const searching = query.length > 0;
  const filtering = filter !== "all";
  const paged = list.pageCount > 1;

  // Neither searching nor paging drops a selection — a row picked on one page
  // or under one query stays picked (and counted) when the current view hides
  // it, so a batch can be built across several pages and searches; the bar
  // names the unseen ones so the count is never a surprise. A selected row
  // removed by another admin meanwhile is tolerated rather than tracked: the
  // bulk actions skip and report ids that no longer exist, which costs one
  // possibly-stale count here but spares every page render a full id list.
  const selectedIds = useMemo(() => [...selected], [selected]);
  const shownIds = new Set(shown.map((m) => m.id));
  const hiddenSelectedCount = selectedIds.filter(
    (id) => !shownIds.has(id),
  ).length;

  const allShownSelected =
    shown.length > 0 && shown.every((m) => selected.has(m.id));
  const someShownSelected = shown.some((m) => selected.has(m.id));

  const select = (id: string, next: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });

  const selectAllShown = (next: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      for (const m of shown) {
        if (next) s.add(m.id);
        else s.delete(m.id);
      }
      return s;
    });

  // The bulk bar's "Select all N matching": the ids come from the server on
  // demand (the page payload carries only the served rows), scoped by the
  // same query + filter the list itself is narrowed by, and join whatever is
  // already selected.
  const selectAllMatching = async () => {
    const res = await matchingMemberIdsAction(query, filter);
    if (!res.ok) return false;
    setSelected((prev) => new Set([...prev, ...res.ids]));
    return true;
  };

  // What the current view is a list *of* — so a filter change reads as one
  // ("No admins match “smith”." after "No members match “smith”.") instead of
  // producing the same sentence twice and going unheard.
  const noun =
    filter === "admins"
      ? "admin"
      : filter === "subscribed"
        ? "subscribed member"
        : filter === "unsubscribed"
          ? "unsubscribed member"
          : "member";
  const nouns = `${noun}s`;

  // The final branch covers the default view: with no search and no filter an
  // empty page can only mean the list changed under the admin's feet, so say
  // something true rather than borrowing another filter's message.
  const emptyMessage = searching
    ? `No ${nouns} match “${query}”.`
    : filter === "admins"
      ? "No admins yet."
      : filter === "subscribed"
        ? "No subscribed members."
        : filter === "unsubscribed"
          ? "No unsubscribed members."
          : "No members to show.";

  // The outcome of the search + filter in one sentence, for the live region
  // below. Built only from the query, the filter and the whole-list match
  // count — never from the selection or the served page — so ticking a
  // checkbox or turning a page leaves the text byte-identical and the region
  // stays silent (a page turn already announces itself in MembersPagination).
  const matching = list.matching;
  const resultMessage =
    matching === 0
      ? emptyMessage
      : searching
        ? `${matching} ${matching === 1 ? `${noun} matches` : `${nouns} match`} “${query}”.`
        : `Showing ${matching} ${matching === 1 ? noun : nouns}.`;

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <MembersSearch query={query} />
        </div>
        <MembersFilter filter={filter} />
      </div>

      <MembersBulkBar
        shownCount={shown.length}
        matching={list.matching}
        searching={searching}
        filtering={filtering}
        paged={paged}
        selectedIds={selectedIds}
        hiddenSelectedCount={hiddenSelectedCount}
        allShownSelected={allShownSelected}
        someShownSelected={someShownSelected}
        onToggleAllShown={selectAllShown}
        onSelectAllMatching={selectAllMatching}
        onClear={() => setSelected(new Set())}
      />

      <div className="border-line text-faint2 mt-3 hidden items-center px-1.5 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase sm:flex">
        <span className="w-11 flex-none" />
        <span className="ml-3 flex-1">Member</span>
        <span className="w-[120px]">Subscription</span>
        <span className="w-[112px]">Role</span>
        <span className="w-[76px]">Joined</span>
        <span className="w-[58px]" />
      </div>

      {shown.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          currentUserId={currentUserId}
          selected={selected.has(m.id)}
          onSelect={select}
        />
      ))}

      {/* The result of the search / filter, live. Mounted whatever the
          outcome — a region that arrives together with its text is announced
          unreliably, and an admin searching for someone who isn't there needs
          to hear the nothing. Visible only when there are no rows, where it is
          also the empty state; otherwise the count is for screen readers, the
          rows themselves being the sighted answer. */}
      <p
        role="status"
        aria-live="polite"
        className={
          shown.length === 0
            ? "text-faint py-10 text-center font-sans text-sm"
            : "sr-only"
        }
      >
        {resultMessage}
      </p>

      <MembersPagination page={list.page} pageCount={list.pageCount} />
    </div>
  );
}
