"use client";

import { useState } from "react";
import { ADMIN_LIST_PAGE } from "@/components/admin-list-layout";
import { EmptyMembers } from "@/components/empty-states";
import { MemberDialog } from "./member-dialog";
import { ImportDialog } from "./import-dialog";
import { MembersTable } from "./members-table";
import { MembersToolbar } from "./members-toolbar";
import type { MemberFilter, MemberList } from "@/server/users";

// Coordinates the members page: the header + toolbar, the table (or first-run
// empty state), and the two dialogs. Owning the open/closed state here lets the
// toolbar buttons and the empty-state CTAs share one add/import flow. The list
// re-renders from the server after each mutation (the actions revalidate
// /admin/members), so the summary line and rows always reflect the database.
export function MembersManager({
  list,
  query,
  filter,
  currentUserId,
}: {
  list: MemberList;
  /** The active search from the URL — "" when the list is unfiltered. */
  query: string;
  /** The active status filter from the URL — "all" when none. */
  filter: MemberFilter;
  currentUserId: string;
}) {
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);

  // Whole-club numbers, so the summary stays true whatever page or search the
  // table below is showing.
  const summary =
    list.total === 0
      ? "No members yet"
      : `${list.total} ${list.total === 1 ? "member" : "members"} · ${list.subscribedTotal} subscribed`;

  const openAdd = () => setDialog("add");
  const openImport = () => setDialog("import");
  const close = () => setDialog(null);

  return (
    <div className={ADMIN_LIST_PAGE}>
      <div className="flex flex-none flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Members</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
        </div>
        <MembersToolbar onImport={openImport} onAdd={openAdd} />
      </div>

      {list.total === 0 ? (
        <div className="mt-8">
          <EmptyMembers onImport={openImport} onAdd={openAdd} />
        </div>
      ) : (
        <MembersTable
          list={list}
          query={query}
          filter={filter}
          currentUserId={currentUserId}
        />
      )}

      {dialog === "add" && <MemberDialog onClose={close} />}
      {dialog === "import" && <ImportDialog onClose={close} />}
    </div>
  );
}
