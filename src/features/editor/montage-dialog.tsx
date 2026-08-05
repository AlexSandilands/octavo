"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, IconButton } from "@/components/ui";
import {
  MAX_MONTAGE_IMAGES,
  MONTAGE_INTERVALS,
  type MontageItem,
} from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { MenuSelect, type MenuSelectItem } from "./menu-select";

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
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus into the panel on open — once, on mount. Tying this to the Escape
  // effect below meant it re-ran whenever `onClose` changed identity (it is an
  // inline arrow in the caller, so on every parent render), snatching focus
  // back to the × every time an edit re-rendered the editor.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Close on Escape, so the dialog is operable from the keyboard alone (the
  // editor canvas behind it also listens for Escape to deselect, so the keydown
  // is stopped here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // This listener is on the capture phase, so it would otherwise close the
      // whole dialog before an open dropdown ever saw the key. A menu owns
      // Escape while it is open — it closes itself and hands focus back to its
      // trigger — and the dialog only takes the key once no menu is showing.
      if (panelRef.current?.querySelector('[role="menu"]')) return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4"
      // The dialog floats over the editor canvas, which deselects the block on
      // a stray click and pans on a drag — neither should reach it.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Montage settings"
        className="bg-card flex max-h-[90vh] w-[560px] flex-col rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="flex flex-none items-center justify-between px-8 pt-7">
          <h2 className="text-ink font-serif text-[26px] leading-tight">
            Montage
          </h2>
          <IconButton
            ref={closeRef}
            icon="close"
            label="Close"
            onClick={onClose}
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
          Readers can always step through with the arrows. Members who ask their
          device for reduced motion never see it move on its own.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6">
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
      </div>
    </div>
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
    <li className="border-hair flex items-center gap-3 rounded-lg border bg-white p-2.5">
      <div className="border-line bg-page flex h-14 w-20 flex-none items-center justify-center overflow-hidden rounded">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-faint2 font-mono text-[9px]">MISSING</span>
        )}
      </div>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Alt text for {position}</span>
        <input
          value={item.alt}
          onChange={(e) => onAlt(e.target.value)}
          maxLength={300}
          placeholder="Describe this photo for screen readers"
          className="border-hair focus:border-accent text-ink h-10 w-full rounded-md border bg-white px-2.5 font-sans text-[13px] outline-none"
        />
      </label>
      <div className="flex flex-none items-center gap-1">
        <RowBtn
          icon="arrowUp"
          label={`Move ${position} earlier`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <RowBtn
          icon="arrowDown"
          label={`Move ${position} later`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        />
        <RowBtn
          icon="trash"
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
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: "arrowUp" | "arrowDown" | "trash";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  // A bordered square, not a house Button and not the quiet inline IconButton —
  // it keeps its own shape and takes only the interaction contract: the pointer,
  // the wash its accent hover already implied, and a transition. The hovers are
  // gated on `enabled:` so a disabled end-of-list arrow promises nothing.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`border-hair flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-white transition-[background-color,border-color,color] duration-150 disabled:cursor-default disabled:opacity-35 ${
        danger
          ? "text-warn enabled:hover:border-warn enabled:hover:bg-warn-soft"
          : "text-muted enabled:hover:border-accent enabled:hover:bg-accent-wash enabled:hover:text-accent"
      }`}
    >
      <Icon name={icon} size={15} strokeWidth={1.9} />
    </button>
  );
}
