"use client";

import { useId } from "react";
import { Icon } from "@/components/icons";
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
  const position = `image ${index + 1} of ${total}`;
  return (
    <li className="border-hair rounded-lg border bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="border-line bg-page flex h-14 w-16 flex-none sm:w-20 items-center justify-center overflow-hidden rounded">
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
        <span className="text-ink flex-1 font-sans text-[13px] font-semibold">
          Image {index + 1}
        </span>
        <div className="ml-auto flex flex-none items-center">
          <IconButton
            icon="arrowUp"
            label={`Move ${position} earlier`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="m-0! h-11! w-11!"
          />
          <IconButton
            icon="arrowDown"
            label={`Move ${position} later`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="m-0! h-11! w-11!"
          />
          <IconButton
            icon="trash"
            label={`Remove ${position}`}
            onClick={onRemove}
            className="m-0! h-11! w-11!"
          />
        </div>
      </div>
      <label className="text-ink block font-sans text-[13px] font-semibold">
        Caption <span className="text-faint2 font-normal">(optional)</span>
        <textarea
          data-montage-caption-input
          aria-label={`Caption for ${position}`}
          value={item.caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          maxLength={300}
          rows={2}
          disabled={sharedCaption}
          placeholder="Add a caption for this image"
          className="border-hair focus:border-accent text-ink mt-1.5 block min-h-16 w-full resize-y rounded-md border bg-white px-3 py-2 font-sans text-[14px] font-normal outline-none disabled:bg-page disabled:text-faint2"
        />
      </label>
      <details className="group/description mt-1">
        <summary className="text-muted hover:text-accent flex min-h-11 cursor-pointer items-center gap-1.5 font-sans text-[13px] transition-colors">
          <Icon
            name="chevronRight"
            size={14}
            className="transition-transform group-open/description:rotate-90"
          />
          Screen-reader description{item.alt.trim() ? " (added)" : ""}
        </summary>
        <p id={`${id}-hint`} className="text-faint2 mb-2 font-sans text-[12px]">
          Describe visual details the caption doesn’t cover. Leave blank if the
          caption already tells the whole story.
        </p>
        <label className="block">
          <span className="sr-only">Alt text for {position}</span>
          <textarea
            value={item.alt}
            onChange={(e) => onChange({ alt: e.target.value })}
            aria-describedby={`${id}-hint`}
            maxLength={300}
            rows={2}
            placeholder="Describe what’s in the photo"
            className="border-hair focus:border-accent text-ink block min-h-16 w-full resize-y rounded-md border bg-white px-3 py-2 font-sans text-[14px] outline-none"
          />
        </label>
      </details>
    </li>
  );
}
