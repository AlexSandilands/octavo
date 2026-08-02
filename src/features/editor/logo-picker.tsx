"use client";

import Link from "next/link";
import type { LogoListItem } from "@/lib/logos";
import { MenuSelect, type MenuSelectItem } from "./menu-select";

// The editor header's footer-mark control: choose one of the marks from the
// logo library (/admin/logos) for this issue's running page footer, or none.
// Uses the same MenuSelect as the theme picker beside it, so the two controls
// are one design rather than a house pill next to a browser dropdown.
// Marks are created and deleted in the library; this only references them.
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
  // opening a menu whose only option is "None".
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

  const selected = logos.find((l) => l.id === logoId);
  // A selection the library no longer contains. Not a dangling row — the FK is
  // set-null, so a stored logoId always names a real logo — but this list is a
  // snapshot from page load: pick a mark here, then delete it in the library in
  // another tab before this editor saves, and the selection outlives it. The
  // trigger says so, visible without opening the menu, and the menu lists only
  // marks that still exist so the admin can just pick again.
  const current = selected ? selected.name : logoId ? "(removed logo)" : "None";

  const items: MenuSelectItem<string | null>[] = [
    { key: "none", value: null, content: <MarkChip /> },
    ...logos.map((l) => ({
      key: l.id,
      value: l.id as string | null,
      content: <MarkChip src={l.image.url} name={l.name} />,
    })),
  ];

  return (
    <MenuSelect
      label="Logo"
      current={current}
      ariaLabel="Issue footer logo"
      items={items}
      value={logoId}
      onSelect={onChange}
    />
  );
}

// A menu row's mark: the image on a white chip so a transparent PNG/WebP reads
// against the menu, with the name beside it. The "None" row keeps the empty
// chip so every row's name starts at the same x.
function MarkChip({ src, name }: { src?: string; name?: string }) {
  return (
    <>
      <span className="border-hair-warm flex h-[22px] w-[30px] flex-none items-center justify-center overflow-hidden rounded border bg-white">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain p-[2px]"
          />
        )}
      </span>
      {name ?? "None"}
    </>
  );
}
