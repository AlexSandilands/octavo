"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SettingsCard } from "@/components/settings-card";
import type { LogoListItem } from "@/lib/logos";
import { LogoRow } from "./logo-row";
import { LogoDialog } from "./logo-dialog";

// The logo library, as one of the cards on /admin/magazine: the list, the add
// button, the empty state, and the add/rename dialog. Mutations run through the
// colocated server actions (which revalidate /admin/magazine); after each we
// router.refresh() so the server-rendered list this component receives reflects
// the change.
//
// Those mutations are immediate — they are not part of the settings form and
// never were, so nothing here waits for its Save button. The card says so in as
// many words, because sitting under that button is otherwise a fair reason to
// assume the opposite.

// null = closed; "new" = add; a logo = rename that record.
type Editing = LogoListItem | "new" | null;

export function LogosManager({ logos }: { logos: LogoListItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <SettingsCard
      id="logos"
      title="Logos"
      blurb="The club’s own marks — a crest, an emblem, a wordmark. Upload each one once and any issue can use it in its page footer. Changes here happen straight away; they don’t wait for Save."
      action={
        logos.length > 0 && (
          <Button
            size="sm"
            icon="plus"
            onClick={() => setEditing("new")}
            className="whitespace-nowrap"
          >
            Add logo
          </Button>
        )
      }
    >
      {logos.length === 0 ? (
        <div className="border-hair-warm rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted font-sans text-[14px] leading-relaxed">
            No marks yet. Add one and it becomes available to every issue.
          </p>
          <div className="mt-4 flex justify-center">
            <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
              Add your first logo
            </Button>
          </div>
        </div>
      ) : (
        <div>
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
    </SettingsCard>
  );
}
