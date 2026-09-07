"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import type { BlockPatch, MontageItem } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { MontageDialog } from "./montage-dialog";

// The montage block's entry in the selected-block toolbar: a count + a button
// that opens the settings panel. The slide list is too big to live in a
// floating strip (unlike the image block's single upload), so it gets a dialog
// — the same shape as the sponsor manager's.
//
// The panel is portalled to <body> deliberately: the editor canvas sits under a
// `transform: scale()` (ScaledPage), and a position:fixed descendant of a
// transformed element is positioned against that element, not the viewport — so
// rendering the modal in place would pin it to the page canvas and scale it.
export function MontageBlockControl({
  items,
  interval,
  issueId,
  images,
  onChange,
  onRegisterImage,
}: {
  items: MontageItem[];
  interval: number;
  issueId: string;
  images: ImageMap;
  onChange: (patch: BlockPatch) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="border-lead text-lead hover:bg-newsprint flex h-8 cursor-pointer items-center gap-1.5 rounded-ui border bg-sheet px-2.5 font-ui text-[12px] font-semibold"
      >
        <Icon name="grid" size={15} />
        {items.length === 0
          ? "Add images"
          : `Edit montage (${items.length} image${items.length === 1 ? "" : "s"})`}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <MontageDialog
            items={items}
            interval={interval}
            issueId={issueId}
            images={images}
            onChangeItems={(next) => onChange({ items: next })}
            onChangeInterval={(seconds) => onChange({ interval: seconds })}
            onRegisterImage={onRegisterImage}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
