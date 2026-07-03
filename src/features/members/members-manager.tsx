"use client";

import { useState } from "react";
import { EmptyMembers } from "@/components/empty-states";
import { AddMemberDialog } from "./add-member-dialog";
import { ImportDialog } from "./import-dialog";
import { MembersTable } from "./members-table";
import { MembersToolbar } from "./members-toolbar";
import type { MemberRow as Member } from "@/server/users";

// Coordinates the members page: the header + toolbar, the table (or first-run
// empty state), and the two dialogs. Owning the open/closed state here lets the
// toolbar buttons and the empty-state CTAs share one add/import flow. The list
// re-renders from the server after each mutation (the actions revalidate
// /admin/members), so the summary line and rows always reflect the database.
export function MembersManager({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);

  const subscribed = members.filter((m) => m.subscribed).length;
  const summary =
    members.length === 0
      ? "No members yet"
      : `${members.length} ${members.length === 1 ? "member" : "members"} · ${subscribed} subscribed`;

  const openAdd = () => setDialog("add");
  const openImport = () => setDialog("import");
  const close = () => setDialog(null);

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Members</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
        </div>
        <MembersToolbar onImport={openImport} onAdd={openAdd} />
      </div>

      {members.length === 0 ? (
        <div className="mt-8">
          <EmptyMembers onImport={openImport} onAdd={openAdd} />
        </div>
      ) : (
        <MembersTable members={members} currentUserId={currentUserId} />
      )}

      {dialog === "add" && <AddMemberDialog onClose={close} />}
      {dialog === "import" && <ImportDialog onClose={close} />}
    </>
  );
}
