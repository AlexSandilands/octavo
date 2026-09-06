"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_LIST_PAGE } from "@/components/admin-list-layout";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyCard } from "@/components/empty-states";
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
      <AdminPageHeader
        title="Sponsors"
        summary={summary}
        stats={[
          { label: "Sponsors", value: list.total, icon: "banner" },
          { label: "Expired", value: list.expiredTotal, icon: "alertCircle" },
        ]}
        actions={
          list.total > 0 ? (
            <Button icon="plus" onClick={() => setEditing("new")}>
              Add sponsor
            </Button>
          ) : undefined
        }
      />

      {list.total === 0 ? (
        <div className="mt-6">
          <EmptyCard
            icon="banner"
            title="No sponsors yet"
            body="Add the patrons who support the club — a logo and a link. You can then drop each one into an issue from the editor."
          >
            <Button icon="plus" onClick={() => setEditing("new")}>
              Add your first sponsor
            </Button>
          </EmptyCard>
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
