"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon, type IconName } from "@/components/icons";
import { BlockView } from "@/features/blocks/block-view";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import {
  blockFlowStyle,
  isFillPage,
  isFloatedPicture,
} from "@/features/blocks/layout";
import type { Block, BlockPatch } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { richDocBlocks } from "@/lib/rich-text-split";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import { OverflowNotice } from "./overflow-notice";
import { ImageBlockControl } from "./image-upload";
import { ImageLayoutControls } from "./image-layout";
import { HeadingLevelControl } from "./heading-level-control";
import { MontageBlockControl } from "./montage-control";
import { VideoBlockControl } from "./video-control";
import { SponsorPicker } from "./sponsor-picker";
import { RichTextEditor } from "./rich-text-editor";

// One block in the editor canvas: the themed BlockView (editable) wrapped in the
// editing chrome — a faint hover outline, a darker selected outline, a left
// drag handle for reordering, and the selected block's type label + controls.
// Reordering uses dnd-kit, so the other blocks slide out of the way as you drag.
export function EditorBlock({
  block,
  theme,
  cover,
  selected,
  issueId,
  images,
  sponsors,
  sponsorMap,
  overflowAt,
  fitsAlone = false,
  onSelect,
  onChange,
  onMove,
  onRemove,
  onFlow,
  onFillPage,
  onRegisterImage,
}: {
  block: Block;
  theme: LayoutTheme;
  cover?: boolean;
  selected: boolean;
  issueId: string;
  images: ImageMap;
  sponsors: SponsorListItem[];
  sponsorMap: SponsorMap;
  /** Where the page ends within this block, when it runs past the page. */
  overflowAt?: number;
  /** Whether this block would fit on a page of its own — i.e. moving it helps. */
  fitsAlone?: boolean;
  onSelect: () => void;
  onChange: (patch: BlockPatch) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onFlow: () => void;
  /** Set this image to fill the whole page (issue #227). */
  onFillPage: () => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // A floated (inline left/right) picture is an earlier sibling than the text
  // that wraps it, so the text block's box paints on top and swallows clicks on
  // the picture. Lift the floated picture above the wrapping text so it stays
  // selectable (and its hover ring isn't hidden behind the text box).
  const floated = isFloatedPicture(block);

  // A full-bleed photo covers the page, so its chrome moves inside the page and
  // scales from its own top edge rather than hanging off the top-left corner.
  const bleed = !cover && isFillPage(block);
  const chromeTop = bleed
    ? "top-2 [transform-origin:top_left]"
    : "bottom-full mb-2";

  // What the marker offers once this block is flagged (#93). Body text with more
  // than one top-level node is split at a node boundary; anything else moves
  // whole, but only when it would actually fit on a page of its own. A block
  // taller than a whole page is marked and left alone — v1 never cuts inside a
  // paragraph, and never resizes an image to make it fit.
  const overflowing = overflowAt !== undefined;
  const splittable =
    block.type === "text" && !cover && richDocBlocks(block.text).length > 1;
  const overflowAction = !overflowing
    ? undefined
    : splittable
      ? { note: "Text overflows this page", label: "Flow onto next page" }
      : fitsAlone
        ? { note: "Overflows this page", label: "Move to next page" }
        : { note: "Taller than a whole page", label: undefined };

  return (
    <div
      ref={setNodeRef}
      // Marks block content so the canvas pan-drag skips it (the block stays
      // selectable, editable and draggable); see onPanDown in editor.tsx.
      data-editor-block
      data-block-id={block.id}
      style={{
        ...blockFlowStyle(block, cover),
        ...(floated && !isDragging ? { zIndex: 5 } : {}),
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      onClick={(e) => {
        // Keep the click from reaching the canvas, which deselects.
        e.stopPropagation();
        onSelect();
      }}
      onFocus={onSelect}
      // A box-shadow "ring" (not outline) so the gap to the text is stable and
      // hover/selected states are pure CSS. The inner page-coloured ring is the
      // breathing room; the outer ring is the visible line.
      className={`group relative cursor-pointer rounded-sm transition-[box-shadow] ${
        isDragging
          ? "z-30 [box-shadow:0_0_0_2px_var(--color-accent),0_12px_28px_rgba(40,36,28,0.22)]"
          : selected
            ? "[box-shadow:0_0_0_6px_var(--color-page),0_0_0_8px_var(--color-accent)]"
            : "hover:[box-shadow:0_0_0_6px_var(--color-page),0_0_0_8px_var(--color-hair)]"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        className={`border-hair-warm absolute z-10 flex h-7 w-6 cursor-grab touch-none items-center justify-center rounded-[5px] border bg-white text-muted transition-opacity active:cursor-grabbing ${
          bleed ? "top-2.5 left-2" : "top-1/2 -left-9 -translate-y-1/2"
        } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <Icon name="grip" size={15} />
      </button>

      {selected && (
        <>
          {block.type === "image" ? (
            <div
              className={`border-hair chrome-unscaled absolute z-20 flex items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)] ${chromeTop} ${bleed ? "left-11" : "left-0"}`}
            >
              <ImageBlockControl
                issueId={issueId}
                hasImage={Boolean(block.imageId)}
                onUploaded={(imageId, image) => {
                  onChange({ imageId });
                  onRegisterImage(imageId, image);
                }}
              />
              {block.imageId && (
                <>
                  <span className="bg-line h-5 w-px" />
                  <ImageLayoutControls
                    align={block.align ?? "full"}
                    width={block.width ?? 100}
                    onChange={onChange}
                    onFillPage={cover ? undefined : onFillPage}
                  />
                  <span className="bg-line h-5 w-px" />
                  <label className="flex items-center gap-1.5">
                    <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.14em] uppercase">
                      Alt
                    </span>
                    <input
                      type="text"
                      value={block.alt ?? ""}
                      onChange={(e) => onChange({ alt: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Describe this photo for screen readers"
                      placeholder="Describe this photo for screen readers"
                      className="border-hair text-ink w-56 rounded-[6px] border bg-white px-2 py-1 font-sans text-[12px]"
                    />
                  </label>
                </>
              )}
            </div>
          ) : block.type === "montage" ? (
            <div className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
              <MontageBlockControl
                items={block.items}
                interval={block.interval}
                issueId={issueId}
                images={images}
                onChange={onChange}
                onRegisterImage={onRegisterImage}
              />
              {block.items.length > 0 && (
                <>
                  <span className="bg-line h-5 w-px" />
                  {/* Placement/size are the image block's controls verbatim —
                      a montage occupies a photo slot, so it sizes like one. */}
                  <ImageLayoutControls
                    align={block.align ?? "full"}
                    width={block.width ?? 100}
                    onChange={onChange}
                  />
                </>
              )}
            </div>
          ) : block.type === "video" ? (
            <div className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
              <VideoBlockControl
                videoId={block.videoId}
                posterImageId={block.posterImageId}
                issueId={issueId}
                images={images}
                onChange={onChange}
                onRegisterImage={onRegisterImage}
              />
              {block.videoId && (
                <>
                  <span className="bg-line h-5 w-px" />
                  {/* Placement/size are the image block's controls verbatim —
                      a video occupies a photo slot, so it sizes like one. */}
                  <ImageLayoutControls
                    align={block.align ?? "full"}
                    width={block.width ?? 100}
                    onChange={onChange}
                  />
                </>
              )}
            </div>
          ) : block.type === "text" && !cover ? (
            // The text block's toolbar (size + formatting) lives inside the
            // rich-text editor below, so nothing is rendered here.
            <></>
          ) : block.type === "heading" && !cover ? (
            <div className="chrome-unscaled absolute bottom-full left-0 z-20 mb-2">
              <HeadingLevelControl
                level={block.level ?? "main"}
                onChange={onChange}
              />
            </div>
          ) : block.type === "sponsor" ? (
            <div className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
              <SponsorPicker
                sponsorId={block.sponsorId}
                sponsors={sponsors}
                onChange={onChange}
              />
            </div>
          ) : (
            <span className="bg-accent text-paper chrome-unscaled absolute bottom-full left-0 z-10 mb-2 rounded-[3px] px-1.5 py-[3px] font-sans text-[9px] font-semibold tracking-[0.1em] uppercase">
              {block.type}
            </span>
          )}
          <div
            className={`absolute z-10 flex flex-col gap-1 ${
              // Bottom corner on a filled page: the top one is where the
              // block's own tool bar lands, at whatever zoom.
              bleed ? "right-2 bottom-2.5" : "top-1/2 -right-9 -translate-y-1/2"
            }`}
          >
            <Ctrl icon="arrowUp" title="Move up" onClick={() => onMove(-1)} />
            <Ctrl
              icon="arrowDown"
              title="Move down"
              onClick={() => onMove(1)}
            />
            <Ctrl icon="trash" title="Delete" danger onClick={onRemove} />
          </div>
        </>
      )}

      {block.type === "text" && !cover ? (
        <RichTextEditor
          value={block.text}
          size={block.size ?? "m"}
          selected={selected}
          onChange={onChange}
        />
      ) : (
        <BlockView
          block={block}
          theme={theme}
          edit={{ onChange }}
          images={images}
          sponsors={sponsorMap}
          variant={cover ? "cover" : undefined}
        />
      )}

      {overflowAt !== undefined && overflowAction && (
        <OverflowNotice
          top={overflowAt}
          note={overflowAction.note}
          action={
            overflowAction.label
              ? { label: overflowAction.label, onClick: onFlow }
              : undefined
          }
        />
      )}
    </div>
  );
}

function Ctrl({
  icon,
  title,
  onClick,
  danger,
}: {
  icon: IconName;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={`border-hair-warm flex h-6 w-6 items-center justify-center rounded-[5px] border bg-white ${
        danger
          ? "text-warn hover:border-warn"
          : "text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <Icon name={icon} size={13} strokeWidth={1.9} />
    </button>
  );
}
