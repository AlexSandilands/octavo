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
import type { Block, BlockPatch, PageAlign } from "@/lib/blocks";
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
  first = false,
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
  /** The page's first block: its tool bar hangs below it, where the stage
   *  can show it, instead of above the page's top edge. */
  first?: boolean;
  onSelect: () => void;
  onChange: (patch: BlockPatch) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onFlow: () => void;
  /** Set this image to fill the whole page (issue #227). */
  onFillPage: (align: PageAlign) => void;
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
  // Under the Drag chip on a filled page (the chip is ~66 page-px tall once the
  // chrome scale has been cancelled), below the page's first block, above the
  // block everywhere else.
  const chromeTop = bleed
    ? "top-20 [--chrome-origin:top_left]"
    : first
      ? "top-full mt-2 [--chrome-origin:top_left]"
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
      // breathing room; the outer ring is the visible line — ink 2px when
      // selected, a hairline on hover, the red while a drag is in flight. No
      // drop shadow: the Broadsheet separates by rules alone.
      className={`group relative cursor-pointer rounded-ui transition-[box-shadow] ${
        isDragging
          ? "z-30 [box-shadow:0_0_0_6px_var(--color-sheet),0_0_0_8px_var(--color-red)]"
          : selected
            ? "[box-shadow:0_0_0_6px_var(--color-sheet),0_0_0_8px_var(--color-lead)]"
            : "hover:[box-shadow:0_0_0_6px_var(--color-sheet),0_0_0_8px_var(--color-hairline-strong)]"
      }`}
    >
      {/* The drag handle: a labelled chip in the page's left margin (inside a
          full-bleed photo, its top-left corner). Anchored by its right edge and
          scaled about it, so the chrome scale never pushes it into the block. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        className={`${CHIP} chrome-unscaled absolute z-10 cursor-grab touch-none transition-opacity active:cursor-grabbing ${
          bleed
            ? "top-2.5 left-2 [--chrome-origin:top_left]"
            : "top-1/2 right-full mr-3 -translate-y-1/2 [--chrome-origin:right_center]"
        } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
      >
        <Icon name="grip" size={14} />
        Drag
      </button>

      {selected && (
        <>
          {block.type === "image" ? (
            <div
              className={`border-hairline-strong chrome-unscaled absolute z-20 flex w-max max-w-[400px] flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-ui border bg-sheet px-2.5 py-1.5 whitespace-nowrap ${chromeTop} ${bleed ? "left-2" : "left-0"}`}
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
                  <span className="bg-hairline-strong h-5 w-px" />
                  <ImageLayoutControls
                    align={block.align ?? "full"}
                    width={block.width ?? 100}
                    onChange={onChange}
                    onFillPage={cover ? undefined : onFillPage}
                  />
                  <span className="bg-hairline-strong h-5 w-px" />
                  <label className="flex items-center gap-1.5">
                    <span className="text-grey-soft font-ui text-[11px] font-semibold tracking-[0.12em] uppercase">
                      Alt
                    </span>
                    <input
                      type="text"
                      value={block.alt ?? ""}
                      onChange={(e) => onChange({ alt: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Describe this photo for screen readers"
                      placeholder="Describe this photo for screen readers"
                      className="border-hairline-strong text-lead focus:border-lead h-8 w-56 rounded-ui border bg-sheet px-2 font-ui text-[13px] outline-none"
                    />
                  </label>
                </>
              )}
            </div>
          ) : block.type === "montage" ? (
            <div className={`border-hairline-strong chrome-unscaled absolute left-0 z-20 flex w-max max-w-[400px] flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-ui border bg-sheet px-2.5 py-1.5 whitespace-nowrap ${chromeTop}`}>
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
                  <span className="bg-hairline-strong h-5 w-px" />
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
            <div className={`border-hairline-strong chrome-unscaled absolute left-0 z-20 flex w-max max-w-[400px] flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-ui border bg-sheet px-2.5 py-1.5 whitespace-nowrap ${chromeTop}`}>
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
                  <span className="bg-hairline-strong h-5 w-px" />
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
            <div className={`chrome-unscaled absolute left-0 z-20 ${chromeTop}`}>
              <HeadingLevelControl
                level={block.level ?? "main"}
                onChange={onChange}
              />
            </div>
          ) : block.type === "sponsor" ? (
            <div className={`border-hairline-strong chrome-unscaled absolute left-0 z-20 flex items-center gap-2.5 rounded-ui border bg-sheet px-2.5 py-1.5 ${chromeTop}`}>
              <SponsorPicker
                sponsorId={block.sponsorId}
                sponsors={sponsors}
                onChange={onChange}
              />
            </div>
          ) : (
            <span className={`border-lead bg-sheet text-lead chrome-unscaled absolute left-0 z-10 flex ${chromeTop} h-7 items-center border px-2 font-ui text-[11px] font-semibold tracking-[0.12em] uppercase`}>
              {block.type}
            </span>
          )}
          {/* The block's handles: labelled chips stacked in the page's right
              margin from the block's top edge (the tool bar sits above the
              block, so the two never meet), anchored at the top-left so the
              chrome scale grows them outward. Bottom corner on a filled page:
              the top one is where the block's own tool bar lands. */}
          <div
            className={`chrome-unscaled absolute z-10 flex flex-col items-start gap-1.5 ${
              bleed
                ? "right-2 bottom-2.5 items-end [--chrome-origin:bottom_right]"
                : "top-0 left-full ml-3 [--chrome-origin:top_left]"
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
          align={block.align}
          selected={selected}
          toolbarBelow={first}
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

// The handle chip: an ink-ruled white box with the word beside its icon. The
// chrome scale nets out at 1.1×, so h-10 lands at the 44px target on screen.
const CHIP =
  "border-lead bg-sheet text-lead hover:bg-newsprint flex h-10 items-center gap-1.5 rounded-ui border px-3 font-ui text-[13px] font-semibold whitespace-nowrap";

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
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`${CHIP} cursor-pointer ${danger ? "text-red" : ""}`}
    >
      <Icon name={icon} size={14} strokeWidth={1.9} />
      {title}
    </button>
  );
}
