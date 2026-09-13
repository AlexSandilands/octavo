"use client";

import { useId, useState } from "react";
import { IconButton } from "@/components/ui";
import type { MontageItem } from "@/lib/blocks";
import type { ResolvedImage } from "@/lib/images";

export function MontageRow({
  item,
  index,
  total,
  image,
  sharedCaption,
  onChange,
  onMove,
  onRemove,
}: {
  item: MontageItem;
  index: number;
  total: number;
  image: ResolvedImage | undefined;
  sharedCaption: boolean;
  onChange: (patch: Partial<MontageItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const position = `image ${index + 1} of ${total}`;
  return (
    <li className="border-hair rounded-lg border bg-white p-2.5">
      <div className="flex items-center gap-2">
        <IconButton
          icon={expanded ? "chevronDown" : "chevronRight"}
          label={`Screen-reader description for ${position}`}
          aria-expanded={expanded}
          aria-controls={`${id}-description`}
          onClick={() => setExpanded((value) => !value)}
          size={16}
          className="m-0! h-11! w-11! flex-none"
        />
        <div className="border-line bg-page flex h-14 w-20 flex-none items-center justify-center overflow-hidden rounded">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-faint2 font-mono text-[9px]">MISSING</span>
          )}
        </div>
        <input
          type="text"
          data-montage-caption-input
          aria-label={`Caption for ${position}`}
          value={item.caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          maxLength={300}
          disabled={sharedCaption}
          placeholder="Caption (optional)"
          className="border-hair focus:border-accent text-ink h-11 min-w-0 flex-1 rounded-md border bg-white px-3 font-sans text-[14px] outline-none disabled:bg-page disabled:text-faint2"
        />
        <div className="flex flex-none items-center">
          <IconButton
            icon="arrowUp"
            label={`Move ${position} earlier`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            size={16}
            className="m-0! h-11! w-11!"
          />
          <IconButton
            icon="arrowDown"
            label={`Move ${position} later`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            size={16}
            className="m-0! h-11! w-11!"
          />
          <IconButton
            icon="trash"
            label={`Remove ${position}`}
            onClick={onRemove}
            size={16}
            className="m-0! h-11! w-11!"
          />
        </div>
      </div>
      <div
        id={`${id}-description`}
        hidden={!expanded}
        className="mt-3 px-2 pb-1"
      >
        <label
          htmlFor={`${id}-alt`}
          className="text-ink block font-sans text-[13px] font-semibold"
        >
          Screen-reader description
        </label>
        <p
          id={`${id}-hint`}
          className="text-faint2 mt-1 mb-2 font-sans text-[12px]"
        >
          Describe visual details the caption doesn’t cover. Leave blank if the
          caption already tells the whole story.
        </p>
        <textarea
          id={`${id}-alt`}
          aria-label={`Alt text for ${position}`}
          value={item.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          aria-describedby={`${id}-hint`}
          maxLength={300}
          rows={2}
          placeholder="Describe what’s in the photo"
          className="border-hair focus:border-accent text-ink block min-h-16 w-full resize-y rounded-md border bg-white px-3 py-2 font-sans text-[14px] outline-none"
        />
      </div>
    </li>
  );
}
