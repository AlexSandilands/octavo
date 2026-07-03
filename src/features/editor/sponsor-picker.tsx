"use client";

import Link from "next/link";
import type { BlockPatch } from "@/lib/blocks";
import type { SponsorListItem } from "@/lib/sponsors";

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
  // A managed reference whose sponsor is gone (deleted): the select can't show
  // it, so surface it and let the admin re-pick or return to manual.
  const missing = Boolean(sponsorId) && !selected;

  const pick = (value: string) => {
    if (!value) {
      // Manual entry: drop the reference; the inline name/href below become the
      // editable, rendered fields again.
      onChange({ sponsorId: undefined });
      return;
    }
    // Point at the managed sponsor and clear the inline fields, so nothing stale
    // lingers to render if the sponsor is later deleted (the slot then hides).
    onChange({ sponsorId: value, name: "", href: undefined, logoId: undefined });
  };

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-faint font-sans text-[11px] font-semibold tracking-[0.1em] uppercase">
        Sponsor
      </span>
      <select
        value={sponsorId ?? ""}
        onChange={(e) => pick(e.target.value)}
        className="border-hair text-ink hover:border-accent h-7 rounded-[6px] border bg-white px-2 font-sans text-[12px] font-semibold"
      >
        <option value="">Manual entry</option>
        {missing && (
          <option value={sponsorId} disabled>
            (removed sponsor)
          </option>
        )}
        {sponsors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.expired ? " (expired)" : ""}
          </option>
        ))}
      </select>
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
