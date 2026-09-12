"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui";
import { KindToggle } from "./kind-toggle";
import type { ImportKind, Region, ReviewItem } from "./model";
import { itemKind, regionPreview } from "./region-text";

function Thumb({ region }: { region: Region }) {
  const [url, setUrl] = useState("");
  const blob = region.image?.blob;
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    // The blob's revocable URL lives exactly as long as this row shows it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? (
    <Image
      src={url}
      alt=""
      width={region.image?.width}
      height={region.image?.height}
      unoptimized
      className="border-hair-warm h-9 w-12 flex-none rounded-[3px] border object-cover"
    />
  ) : null;
}

// The selection in the order it will be added: retype, reorder or drop a row.
// A sheet floating above the panel's tool bar, in the bar's own pill.
export function SelectionList({
  items,
  disabled,
  onKind,
  onMove,
  onRemove,
}: {
  items: ReviewItem[];
  disabled: boolean;
  onKind: (region: Region, kind: ImportKind) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <ol
      id="pdf-import-selection"
      aria-label="Selected content, in the order it will be added"
      className="border-hair-warm divide-line-soft scrollbar-soft pointer-events-auto max-h-[40vh] w-full max-w-[560px] divide-y overflow-y-auto rounded-[14px] border bg-white shadow-[0_8px_28px_rgba(40,36,28,0.22)] [--scrollbar-surface:white]"
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          className="flex items-center gap-2.5 py-1.5 pr-2 pl-3"
        >
          <span className="text-faint2 w-5 flex-none text-right font-sans text-[12px] tabular-nums">
            {index + 1}
          </span>
          <KindToggle
            kind={itemKind(item)}
            image={item.region.kind === "image"}
            size="sm"
            onChange={(kind) => onKind(item.region, kind)}
          />
          {item.region.kind === "image" && <Thumb region={item.region} />}
          <span className="text-body min-w-0 flex-1 truncate text-[14px]">
            {regionPreview(item.region)}
          </span>
          <span className="bg-chip text-faint flex-none rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold">
            p.{item.page}
          </span>
          <span className="flex flex-none items-center gap-2.5 pl-1">
            <IconButton
              icon="arrowUp"
              label="Move up"
              size={16}
              disabled={disabled || index === 0}
              onClick={() => onMove(item.id, -1)}
            />
            <IconButton
              icon="arrowDown"
              label="Move down"
              size={16}
              disabled={disabled || index === items.length - 1}
              onClick={() => onMove(item.id, 1)}
            />
            <IconButton
              icon="close"
              label="Remove from selection"
              size={16}
              disabled={disabled}
              onClick={() => onRemove(item.id)}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
