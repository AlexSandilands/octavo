"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { LogoListItem } from "@/lib/logos";
import { LogoRow } from "./logo-row";
import { LogoDialog } from "./logo-dialog";

// Client owner of the logos admin: the header actions, the empty state, the
// list, and the add/rename dialog. Mutations run through the colocated server
// actions (which revalidate /admin/logos); after each we router.refresh() so the
// server-rendered list this component receives reflects the change.

// null = closed; "new" = add; a logo = rename that record.
type Editing = LogoListItem | "new" | null;

export function LogosManager({ logos }: { logos: LogoListItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);

  const summary =
    logos.length === 0
      ? "No logos yet"
      : `${logos.length} ${logos.length === 1 ? "logo" : "logos"}`;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Logos</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
        </div>
        {logos.length > 0 && (
          <Button
            icon="plus"
            onClick={() => setEditing("new")}
            className="w-full whitespace-nowrap sm:w-auto"
          >
            Add logo
          </Button>
        )}
      </div>

      {logos.length === 0 ? (
        <div className="mt-8">
          <div className="bg-card border-line flex min-h-[360px] flex-col items-center justify-center rounded-md border p-9 text-center shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
            <div className="bg-tint text-accent flex h-[72px] w-[72px] items-center justify-center rounded-full">
              <Icon name="image" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-ink mt-5 font-serif text-2xl">No logos yet</h2>
            <p className="text-muted mt-2.5 max-w-sm font-sans text-[15px] leading-relaxed">
              Keep the club&rsquo;s marks here — a crest, an emblem, a wordmark.
              Upload each one once and other parts of the magazine can use it.
            </p>
            <div className="mt-6">
              <Button icon="plus" onClick={() => setEditing("new")}>
                Add your first logo
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="border-line text-faint2 hidden items-center border-b px-1.5 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase sm:flex">
            <span className="flex-1">Logo</span>
            <span className="w-[110px]" />
          </div>
          {logos.map((logo) => (
            <LogoRow
              key={logo.id}
              logo={logo}
              onRename={() => setEditing(logo)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <LogoDialog
          logo={editing === "new" ? null : editing}
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
