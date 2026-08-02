"use client";

import Link from "next/link";
import type { LogoListItem } from "@/lib/logos";

// The editor header's footer-mark control: choose one of the marks from the
// logo library (/admin/logos) for this issue's running page footer, or none.
// A native select for the same reason the sponsor block's picker is one — the
// job is "point at a managed record", and the browser's own control brings
// keyboard and screen-reader behaviour we'd otherwise have to rebuild. Marks
// are created and deleted in the library; this only references them.
export function LogoPicker({
  logos,
  logoId,
  onChange,
}: {
  logos: LogoListItem[];
  logoId: string | null;
  onChange: (logoId: string | null) => void;
}) {
  // Nothing to choose from and nothing chosen: point at the library instead of
  // showing a select whose only option is "None".
  if (logos.length === 0 && !logoId) {
    return (
      <Link
        href="/admin/logos"
        target="_blank"
        className="text-accent font-sans text-[13px] font-medium underline underline-offset-2"
      >
        Add a logo
      </Link>
    );
  }
  // A reference whose logo is gone — only reachable if the mark's image row was
  // removed underneath it (deleting a referenced logo is refused). Surface it so
  // the admin can re-pick rather than silently showing "None".
  const missing = Boolean(logoId) && !logos.some((l) => l.id === logoId);

  return (
    <label className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-faint font-sans text-[11px] font-semibold tracking-[0.1em] uppercase">
        Logo
      </span>
      <select
        value={logoId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-hair-warm text-ink hover:border-accent h-10 rounded-lg border-[1.5px] bg-white px-2.5 font-sans text-sm font-medium"
      >
        <option value="">None</option>
        {missing && (
          <option value={logoId ?? ""} disabled>
            (removed logo)
          </option>
        )}
        {logos.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
