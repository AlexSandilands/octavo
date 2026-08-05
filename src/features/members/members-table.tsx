"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { MemberRow } from "./member-row";
import { MembersBulkBar } from "./members-bulk-bar";
import type { MemberRow as Member } from "@/server/users";

export function MembersTable({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const q = query.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      !q ||
      (m.name ?? "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q),
  );

  // Searching never drops a selection — a row picked under one query stays
  // picked (and counted) when the next query hides it, so a batch can be built
  // from several searches; the bar names the hidden ones so the count is never
  // a surprise. Rows that have left the list entirely (removed here or by
  // another admin) are the one exception: they're filtered out so the count
  // can't drift above what exists.
  const present = useMemo(() => new Set(members.map((m) => m.id)), [members]);
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

  return (
    <div className="mt-5">
      <div className="border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3.5">
        <Icon name="search" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search members by name or email"
          className="text-ink flex-1 border-none bg-transparent font-sans text-[15px] outline-none"
        />
      </div>

      <MembersBulkBar
        shownCount={shown.length}
        filtered={q.length > 0}
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
          No members match “{query}”.
        </p>
      )}
    </div>
  );
}
