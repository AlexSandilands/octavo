"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { SponsorListItem } from "@/lib/sponsors";
import { SponsorRow } from "./sponsor-row";
import { SponsorDialog } from "./sponsor-dialog";

// Client owner of the sponsors admin: the header actions, the empty state, the
// table, and the add/edit dialog. Mutations run through the colocated server
// actions (which revalidate /admin/sponsors); after each we router.refresh() so
// the server-rendered list this component receives reflects the change.

// null = closed; "new" = add; a sponsor = edit that record.
type Editing = SponsorListItem | "new" | null;

export function SponsorsManager({
  sponsors,
}: {
  sponsors: SponsorListItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);

  const expiredCount = sponsors.filter((s) => s.expired).length;
  const summary =
    sponsors.length === 0
      ? "No sponsors yet"
      : `${sponsors.length} ${sponsors.length === 1 ? "sponsor" : "sponsors"}` +
        (expiredCount > 0 ? ` · ${expiredCount} expired` : "");

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Sponsors</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
        </div>
        {sponsors.length > 0 && (
          <Button icon="plus" onClick={() => setEditing("new")}>
            Add sponsor
          </Button>
        )}
      </div>

      {sponsors.length === 0 ? (
        <div className="mt-8">
          <div className="bg-card border-line flex min-h-[360px] flex-col items-center justify-center rounded-md border p-9 text-center shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
            <div className="bg-tint text-accent flex h-[72px] w-[72px] items-center justify-center rounded-full">
              <Icon name="banner" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-ink mt-5 font-serif text-2xl">
              No sponsors yet
            </h2>
            <p className="text-muted mt-2.5 max-w-sm font-sans text-[15px] leading-relaxed">
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
        <div className="mt-6">
          <div className="border-line text-faint2 flex items-center border-b px-1.5 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase">
            <span className="flex-1">Sponsor</span>
            <span className="w-[190px]">Link</span>
            <span className="w-[150px]">Active until</span>
            <span className="w-[80px]" />
          </div>
          {sponsors.map((s) => (
            <SponsorRow
              key={s.id}
              sponsor={s}
              onEdit={() => setEditing(s)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
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
    </>
  );
}
