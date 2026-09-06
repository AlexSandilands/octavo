"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_LIST_PAGE } from "@/components/admin-list-layout";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type {
  SponsorFilter,
  SponsorList,
  SponsorListItem,
} from "@/lib/sponsors";
import { SponsorsTable } from "./sponsors-table";
import { SponsorDialog } from "./sponsor-dialog";

// Client owner of the sponsors admin: the header actions, the empty state, the
// table, and the add/edit dialog. Mutations run through the colocated server
// actions (which revalidate /admin/sponsors); after each we router.refresh() so
// the server-rendered list this component receives reflects the change.

// null = closed; "new" = add; a sponsor = edit that record.
type Editing = SponsorListItem | "new" | null;

export function SponsorsManager({
  list,
  query,
  filter,
}: {
  list: SponsorList;
  /** The active search from the URL — "" when the list is unfiltered. */
  query: string;
  /** The active status filter from the URL — "all" when none. */
  filter: SponsorFilter;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);

  // Whole-list numbers, so the summary stays true whichever page — and
  // whichever search — is showing.
  const summary =
    list.total === 0
      ? "No sponsors yet"
      : `${list.total} ${list.total === 1 ? "sponsor" : "sponsors"}` +
        (list.expiredTotal > 0 ? ` · ${list.expiredTotal} expired` : "");

  return (
    // Pinned header and filters over scrolling rows from md up; see
    // admin-list-layout.ts.
    <div className={ADMIN_LIST_PAGE}>
      <div className="flex flex-none flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lead font-display text-3xl">Sponsors</h1>
          <p className="text-grey-soft mt-1.5 font-ui text-sm">{summary}</p>
        </div>
        {list.total > 0 && (
          <Button
            icon="plus"
            onClick={() => setEditing("new")}
            className="w-full whitespace-nowrap sm:w-auto"
          >
            Add sponsor
          </Button>
        )}
      </div>

      {list.total === 0 ? (
        <div className="mt-8">
          <div className="bg-sheet border-hairline flex min-h-[360px] flex-col items-center justify-center rounded-ui border p-9 text-center">
            <div className="bg-newsprint text-red flex h-[72px] w-[72px] items-center justify-center rounded-full">
              <Icon name="banner" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-lead mt-5 font-display text-2xl">
              No sponsors yet
            </h2>
            <p className="text-grey mt-2.5 max-w-sm font-ui text-[15px] leading-relaxed">
              Add the patrons who support the club — a logo and a link. You can
              then drop each one into an issue from the editor.
            </p>
            <div className="mt-6">
              <Button icon="plus" onClick={() => setEditing("new")}>
                Add your first sponsor
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <SponsorsTable
          list={list}
          query={query}
          filter={filter}
          onEdit={setEditing}
          onChanged={() => router.refresh()}
        />
      )}

      {editing !== null && (
        <SponsorDialog
          sponsor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
