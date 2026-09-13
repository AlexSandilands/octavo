"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { DialogShell } from "@/components/dialog-shell";
import { Button, IconButton } from "@/components/ui";
import {
  MAX_MONTAGE_IMAGES,
  MONTAGE_INTERVALS,
  type MontageItem,
} from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import { MontageRow } from "./montage-row";

// The montage block's settings panel (issue #95): the slide list — add, remove,
// reorder, per-image captions and alt text — plus the cross-fade interval. Modelled on the
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
  caption,
  onUseItemCaptions,
  issueId,
  images,
  onChangeItems,
  onChangeInterval,
  onRegisterImage,
  onClose,
}: {
  items: MontageItem[];
  interval: number;
  caption: string;
  onUseItemCaptions: () => void;
  issueId: string;
  images: ImageMap;
  onChangeItems: (items: MontageItem[]) => void;
  onChangeInterval: (seconds: number) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ items, onChangeItems });
  useEffect(() => {
    latest.current = { items, onChangeItems };
  }, [items, onChangeItems]);
  const hasSharedCaption = !!caption.trim();
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
        added.push({ imageId: data.imageId, alt: "", caption: "" });
      }
      if (files.length > room) {
        setError(`A montage holds at most ${MAX_MONTAGE_IMAGES} images.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      // Keep whatever landed before the failure — re-uploading successful
      // images to recover from one bad file would be a poor trade.
      if (added.length > 0) {
        latest.current.onChangeItems([...latest.current.items, ...added]);
      }
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
      panelClassName="bg-card flex max-h-[90vh] w-[672px] flex-col rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      isolatePointerEvents
      locked={uploading}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="flex flex-none items-center justify-between px-8 pt-7">
            <h2
              id={titleId}
              className="text-ink font-serif text-[26px] leading-tight"
            >
              Montage
            </h2>
            <IconButton
              icon="close"
              label="Close"
              onClick={onClose}
              disabled={uploading}
            />
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
          <p className="text-faint2 flex-none px-8 pt-2 font-sans text-[12px]">
            Readers can always step through with the arrows. Members who ask
            their device for reduced motion never see it move on its own.
          </p>

          <div
            ref={listRef}
            className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-8 pt-6 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]"
          >
            {hasSharedCaption && (
              <div className="border-hair bg-page mb-5 rounded-lg border p-4">
                <p className="text-ink font-sans text-[13px] font-semibold">
                  Shared caption
                </p>
                <p className="text-muted mt-2 whitespace-pre-wrap font-serif text-[15px]">
                  {caption}
                </p>
                <p className="text-faint2 my-3 font-sans text-[12px]">
                  This caption still appears with every image. Switching copies
                  it to each image without a caption, ready for you to edit or
                  remove.
                </p>
                <Button
                  variant="secondary"
                  disabled={items.length === 0}
                  onClick={() => {
                    onUseItemCaptions();
                    requestAnimationFrame(() =>
                      listRef.current
                        ?.querySelector<HTMLInputElement>(
                          "[data-montage-caption-input]",
                        )
                        ?.focus(),
                    );
                  }}
                >
                  Use captions per image
                </Button>
              </div>
            )}
            <p className="text-faint2 mb-4 font-sans text-[13px]">
              Each caption appears with its image. Leave it blank to show just
              the photo.
            </p>
            <span className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase">
              Images ({items.length})
            </span>
            {items.length === 0 ? (
              <p className="border-hair text-faint2 rounded-lg border border-dashed px-4 py-8 text-center font-sans text-[13px]">
                No images yet. Add two or more to build a montage.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {items.map((item, i) => (
                  <MontageRow
                    key={`${item.imageId}-${items.slice(0, i).filter((other) => other.imageId === item.imageId).length}`}
                    item={item}
                    index={i}
                    total={items.length}
                    image={images[item.imageId]}
                    sharedCaption={hasSharedCaption}
                    onChange={(patch) =>
                      onChangeItems(
                        items.map((it, j) =>
                          j === i ? { ...it, ...patch } : it,
                        ),
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
            <p className="text-warn flex-none px-8 pt-4 font-sans text-[13px] font-semibold">
              {error}
            </p>
          )}

          <div className="flex flex-none items-center justify-between px-8 pt-6 pb-7">
            {/* Two different states, so two different props: uploading is `busy`
              (undimmed — work in progress), a full montage is `disabled`. */}
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              busy={uploading}
              disabled={room <= 0}
            >
              <Icon name="upload" size={17} className="text-accent" />
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
