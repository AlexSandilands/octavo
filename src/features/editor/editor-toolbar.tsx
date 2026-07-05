"use client";

import { Icon, type IconName } from "@/components/icons";
import type { BlockType } from "@/lib/blocks";

const INSERT: { type: BlockType; label: string; icon: IconName }[] = [
  { type: "heading", label: "Heading", icon: "heading" },
  { type: "text", label: "Text", icon: "menu" },
  { type: "image", label: "Image", icon: "image" },
  { type: "sponsor", label: "Sponsor", icon: "banner" },
];

// The canvas toolbar: block-insert buttons on the left, the cover-page toggle on
// the right. The first page is always the cover, so the toggle is disabled there.
export function EditorToolbar({
  onAddBlock,
  onToggleCover,
  coverDisabled,
  coverActive,
}: {
  onAddBlock: (type: BlockType) => void;
  onToggleCover: () => void;
  coverDisabled: boolean;
  coverActive: boolean;
}) {
  return (
    <div className="bg-paper border-line flex h-[52px] flex-none items-center gap-2.5 border-b px-5">
      <span className="text-faint mr-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">
        Insert
      </span>
      {INSERT.map((b) => (
        <button
          key={b.type}
          onClick={() => onAddBlock(b.type)}
          className="text-ink hover:border-accent border-hair-warm hover:bg-accent-wash flex h-[34px] items-center gap-1.5 rounded-[7px] border bg-white px-3.5 font-sans text-[13px] font-semibold transition-[transform,background-color,border-color] duration-150 ease-out select-none motion-safe:active:scale-95"
        >
          <Icon name={b.icon} size={15} className="text-accent" />
          {b.label}
        </button>
      ))}
      <div className="ml-auto flex items-center">
        <button
          onClick={onToggleCover}
          disabled={coverDisabled}
          aria-pressed={coverActive}
          title={
            coverDisabled
              ? "The first page is always the cover"
              : "Lay this page out as a cover"
          }
          className={`flex h-[34px] items-center gap-1.5 rounded-[7px] border px-3.5 font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none motion-safe:active:scale-95 ${
            coverActive
              ? "border-accent bg-accent text-paper"
              : "text-ink border-hair-warm hover:border-accent hover:bg-accent-wash bg-white"
          } ${coverDisabled ? "cursor-default opacity-90" : ""}`}
        >
          <Icon name="doc" size={15} />
          Cover page
        </button>
      </div>
    </div>
  );
}
