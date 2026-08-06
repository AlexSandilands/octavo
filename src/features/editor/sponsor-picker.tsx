"use client";

import Link from "next/link";
import type { BlockPatch } from "@/lib/blocks";
import type { SponsorListItem } from "@/lib/sponsors";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";

// The editor-only control for a sponsor block: choose a managed sponsor (the
// primary flow — the block then renders that sponsor's live name/logo/link), or
// fall back to "Manual entry" and type an ad-hoc name/href in place. Presentation
// of the card stays in BlockView; this is just the chooser, mirroring the image
// block's upload control.
//
// Manual entry is kept deliberately: it is the exact version-1 rendering path
// (inline name/href, no sponsorId), so legacy blocks stay editable here, and it
// lets an admin drop a one-off mention without creating a managed record.
export function SponsorPicker({
  sponsorId,
  sponsors,
  onChange,
}: {
  sponsorId?: string;
  sponsors: SponsorListItem[];
  onChange: (patch: BlockPatch) => void;
}) {
  const selected = sponsorId
    ? sponsors.find((s) => s.id === sponsorId)
    : undefined;

  const pick = (value: string | null) => {
    if (!value) {
      // Manual entry: drop the reference; the inline name/href below become the
      // editable, rendered fields again.
      onChange({ sponsorId: undefined });
      return;
    }
    // Point at the managed sponsor and clear the inline fields, so nothing stale
    // lingers to render if the sponsor is later deleted (the slot then hides).
    onChange({
      sponsorId: value,
      name: "",
      href: undefined,
      logoId: undefined,
    });
  };

  // A managed reference whose sponsor is gone (deleted): the menu lists only
  // sponsors that still exist, so the trigger says so — visible without opening
  // it — and the admin can re-pick or return to manual entry.
  const current = selected
    ? `${selected.name}${selected.expired ? " (expired)" : ""}`
    : sponsorId
      ? "(removed sponsor)"
      : "Manual entry";

  const items: MenuSelectItem<string | null>[] = [
    { key: "manual", value: null, content: "Manual entry" },
    ...sponsors.map((s) => ({
      key: s.id,
      value: s.id as string | null,
      content: `${s.name}${s.expired ? " (expired)" : ""}`,
    })),
  ];

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <MenuSelect
        label="Sponsor"
        current={current}
        ariaLabel="Block sponsor"
        items={items}
        value={sponsorId ?? null}
        onSelect={pick}
      />
      {sponsors.length === 0 && !selected && (
        <Link
          href="/admin/sponsors"
          target="_blank"
          className="text-accent font-sans text-[12px] font-medium underline underline-offset-2"
        >
          Add sponsors
        </Link>
      )}
    </div>
  );
}
