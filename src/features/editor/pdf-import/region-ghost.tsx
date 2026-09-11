"use client";

import Image from "next/image";
import { Icon } from "@/components/icons";
import { blockKind } from "../block-kinds";
import type { ReviewItem } from "./model";
import { itemKind, regionPreview } from "./region-text";

// What rides under the pointer while a region is dragged out of the PDF: its
// kind and a line of its content, or the photo. It quietens once the page is
// showing the block itself in place.
export function RegionGhost({
  item,
  imageUrl,
  placed,
  note,
}: {
  item: ReviewItem;
  imageUrl: string | null;
  placed: boolean;
  /** Replaces the content line, e.g. where a cover page will send the block. */
  note?: string;
}) {
  const k = blockKind(itemKind(item));
  const image = item.region.image;
  return (
    <div
      className={`border-hair-warm flex max-w-[280px] items-center gap-2.5 rounded-[12px] border bg-white py-2 pr-3.5 pl-2.5 font-sans shadow-[0_8px_28px_rgba(40,36,28,0.22)] transition-opacity duration-150 ${
        placed ? "opacity-60" : ""
      }`}
    >
      {imageUrl && image ? (
        <Image
          src={imageUrl}
          alt=""
          width={image.width}
          height={image.height}
          unoptimized
          className="border-hair-warm h-9 w-12 flex-none rounded-[3px] border object-cover"
        />
      ) : (
        <span className="bg-tint text-accent flex h-8 w-8 flex-none items-center justify-center rounded-[8px]">
          <Icon name={k.icon} size={16} />
        </span>
      )}
      <span className="min-w-0">
        <span className="text-faint block text-[11px] font-semibold tracking-[0.08em] uppercase">
          {k.label}
        </span>
        <span className="text-ink block truncate text-[13px]">
          {note ?? regionPreview(item.region)}
        </span>
      </span>
    </div>
  );
}
