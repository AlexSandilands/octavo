"use client";

import { useMemo, useState } from "react";
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
  // names the unseen ones so the count is never a surprise. Rows that have
  // left the list entirely (removed here or by another admin) are the one
  // exception: they're pruned against the full id list so the count can't
  // drift above what exists.
  const present = useMemo(() => new Set(list.allIds), [list.allIds]);
  const selectedIds = useMemo(
    () => [...selected].filter((id) => present.has(id)),
    [selected, present],
  );
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

  const emptyMessage = searching
    ? `No members match “${query}”.`
    : filter === "admins"
      ? "No admins yet."
      : filter === "subscribed"
        ? "No subscribed members."
        : "No unsubscribed members.";

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
        searching={searching}
        filtering={filtering}
        paged={paged}
        selectedIds={selectedIds}
        hiddenSelectedCount={hiddenSelectedCount}
        allShownSelected={allShownSelected}
        someShownSelected={someShownSelected}
        onToggleAllShown={selectAllShown}
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

      {shown.length === 0 && (
        <p className="text-faint py-10 text-center font-sans text-sm">
          {emptyMessage}
        </p>
      )}

      <MembersPagination page={list.page} pageCount={list.pageCount} />
    </div>
  );
}
