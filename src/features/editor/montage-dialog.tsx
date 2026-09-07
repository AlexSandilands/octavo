"use client";

import { useRef, useState } from "react";
import { DialogShell, dialogPanel } from "@/components/dialog-shell";
import { DialogTitle } from "@/components/dialog-parts";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import {
  MAX_MONTAGE_IMAGES,
  MONTAGE_INTERVALS,
  type MontageItem,
} from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";

// The montage block's settings panel (issue #95): the slide list — add, remove,
// reorder, per-slide alt text — plus the cross-fade interval. Modelled on the
// sponsor dialog (same modal shell, same colocated upload) because it is the
// same job: a block whose content is too big for a floating toolbar.
//
// Uploads go through POST /api/admin/images, the identical pipeline the image
// block and the sponsor logo use (WebP via sharp + an `images` row); the
// returned id is appended as a slide and handed back to the editor so the
// canvas can preview it immediately. Every edit writes back through the block's
// normal `onChange`, so it rides the existing autosave — this dialog persists
// nothing itself.

export function MontageDialog({
  items,
  interval,
  issueId,
  images,
  onChangeItems,
  onChangeInterval,
  onRegisterImage,
  onClose,
}: {
  items: MontageItem[];
  interval: number;
  issueId: string;
  images: ImageMap;
  onChangeItems: (items: MontageItem[]) => void;
  onChangeInterval: (seconds: number) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalItems: MenuSelectItem<number>[] = MONTAGE_INTERVALS.map(
    (o) => ({
      key: String(o.value),
      value: o.value,
      content: o.label,
    }),
  );
  const intervalLabel =
    MONTAGE_INTERVALS.find((o) => o.value === interval)?.label ??
    `${interval} seconds`;

  const room = MAX_MONTAGE_IMAGES - items.length;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same files be re-picked after an error
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const added: MontageItem[] = [];
    try {
      // Sequential on purpose: sharp re-encodes each upload, and a montage is
      // authored a handful of images at a time — parallel uploads would only
      // trade a legible progress state for contention.
      for (const file of files.slice(0, room)) {
        const body = new FormData();
        body.append("file", file);
        body.append("issueId", issueId);
        const res = await fetch("/api/admin/images", {
          method: "POST",
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
        onRegisterImage(data.imageId, {
          url: data.url,
          width: data.width,
          height: data.height,
        });
        added.push({ imageId: data.imageId, alt: "" });
      }
      if (files.length > room) {
        setError(`A montage holds at most ${MAX_MONTAGE_IMAGES} images.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      // Keep whatever landed before the failure — re-uploading successful
      // images to recover from one bad file would be a poor trade.
      if (added.length > 0) onChangeItems([...items, ...added]);
      setUploading(false);
    }
  };

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const moved = next[from]!;
    next[from] = next[to]!;
    next[to] = moved;
    onChangeItems(next);
  };

  return (
    // The dialog floats over the editor canvas, which deselects the block on a
    // stray click and pans on a drag — neither should reach it, and nor should
    // the Escape that closes this (the shell stops it).
    <DialogShell
      panelClassName={dialogPanel("flex max-h-[90vh] w-[560px] flex-col")}
      isolatePointerEvents
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="flex-none px-8 pt-7">
            <DialogTitle id={titleId} onClose={onClose}>
              Montage
            </DialogTitle>
          </div>

          {/* The house dropdown, not a native <select>: a styled select still
            opens the operating system's own picker, and this is the one
            dropdown the rest of the admin uses. It names itself in its
            trigger ("Change image every: 5 seconds"), the same labelling the
            magazine settings cards use, so the words stay visible without a
            second copy of them above it. */}
          <div className="flex flex-none px-8 pt-5">
            <MenuSelect
              label="Change image every"
              current={intervalLabel}
              ariaLabel="Change image every"
              items={intervalItems}
              value={interval}
              onSelect={onChangeInterval}
            />
          </div>
          <p className="text-grey-soft flex-none px-8 pt-2 font-ui text-[12px]">
            Readers can always step through with the arrows. Members who ask
            their device for reduced motion never see it move on its own.
          </p>

          <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-8 pt-6 [--scrollbar-surface:var(--color-sheet)] [scrollbar-gutter:stable]">
            <span className="small-caps text-grey-soft mb-2 block">
              Images ({items.length})
            </span>
            {items.length === 0 ? (
              <p className="border-hairline text-grey-soft rounded-ui border border-dashed px-4 py-8 text-center font-ui text-[13px]">
                No images yet. Add two or more to build a montage.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {items.map((item, i) => (
                  <MontageRow
                    key={`${item.imageId}-${i}`}
                    item={item}
                    index={i}
                    total={items.length}
                    image={images[item.imageId]}
                    onAlt={(alt) =>
                      onChangeItems(
                        items.map((it, j) => (j === i ? { ...it, alt } : it)),
                      )
                    }
                    onMove={(dir) => move(i, dir)}
                    onRemove={() =>
                      onChangeItems(items.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-red flex-none px-8 pt-4 font-ui text-[13px] font-semibold">
              {error}
            </p>
          )}

          <div className="rule-heavy mt-6 flex flex-none flex-wrap items-center justify-between gap-3 px-8 pt-4 pb-6">
            {/* Two different states, so two different props: uploading is `busy`
              (undimmed — work in progress), a full montage is `disabled`. */}
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              busy={uploading}
              disabled={room <= 0}
            >
              <Icon name="upload" size={17} className="text-red" />
              {uploading
                ? "Uploading…"
                : room <= 0
                  ? "Montage full"
                  : "Add images"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onFiles}
              className="hidden"
            />
            <Button
              onClick={onClose}
              disabled={uploading}
              icon="check"
              iconPosition="left"
            >
              Done
            </Button>
          </div>
        </>
      )}
    </DialogShell>
  );
}

function MontageRow({
  item,
  index,
  total,
  image,
  onAlt,
  onMove,
  onRemove,
}: {
  item: MontageItem;
  index: number;
  total: number;
  image: ResolvedImage | undefined;
  onAlt: (alt: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const position = `image ${index + 1} of ${total}`;
  return (
    <li className="border-hairline flex items-center gap-3 rounded-ui border bg-white p-2.5">
      <div className="border-hairline bg-sheet flex h-14 w-20 flex-none items-center justify-center overflow-hidden rounded-ui">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="small-caps text-grey-soft">Missing</span>
        )}
      </div>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Alt text for {position}</span>
        <input
          value={item.alt}
          onChange={(e) => onAlt(e.target.value)}
          maxLength={300}
          placeholder="Describe this photo for screen readers"
          className="border-hairline focus:border-red text-lead h-10 w-full rounded-ui border bg-white px-2.5 font-ui text-[13px] outline-none"
        />
      </label>
      <div className="flex flex-none items-center gap-1">
        <RowBtn
          icon="arrowUp"
          word="Up"
          label={`Move ${position} earlier`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <RowBtn
          icon="arrowDown"
          word="Down"
          label={`Move ${position} later`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        />
        <RowBtn
          icon="trash"
          word="Remove"
          label={`Remove ${position}`}
          danger
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

function RowBtn({
  icon,
  word,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: "arrowUp" | "arrowDown" | "trash";
  /** The short word shown beside the icon; `label` is the full accessible name. */
  word: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  // A ruled chip with its word, not a house Button — it keeps its own compact
  // shape and takes only the interaction contract. The hovers are gated on
  // `enabled:` so a disabled end-of-list arrow promises nothing.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`border-lead flex h-9 cursor-pointer items-center gap-1 rounded-ui border bg-white px-2 font-ui text-[13px] font-semibold transition-[background-color,border-color,color] duration-150 disabled:cursor-default disabled:opacity-35 ${
        danger ? "text-red" : "text-lead"
      } enabled:hover:bg-newsprint`}
    >
      <Icon name={icon} size={14} strokeWidth={1.9} />
      {word}
    </button>
  );
}
