"use client";
import { Icon, type IconName } from "@/components/icons";
import type { Block, BlockPatch, PageAlign } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorListItem } from "@/lib/sponsors";
import type { ReactNode } from "react";
import { ImageBlockControl } from "./image-upload";
import { ImageLayoutControls } from "./image-layout";
import { HeadingLevelControl } from "./heading-level-control";
import { MontageBlockControl } from "./montage-control";
import { VideoBlockControl } from "./video-control";
import { SponsorPicker } from "./sponsor-picker";
import { AltControl } from "./alt-control";
import { BarRule } from "./bar-rule";
import { useBarFit } from "./use-bar-fit";
import { useCoverToolbarBounds } from "./use-cover-toolbar-bounds";

// A selected block's own chrome, where it isn't a cover item: the tool bar for
// its kind (or a bare type label) above it, and move/delete down its right side.
export function EditorBlockBar({
  block,
  cover,
  bleed,
  issueId,
  images,
  sponsors,
  ask,
  onChange,
  onMove,
  onRemove,
  onFillPage,
  onRegisterImage,
}: {
  block: Block;
  cover?: boolean;
  /** A full-bleed photo: its chrome sits inside the page. */
  bleed: boolean;
  issueId: string;
  images: ImageMap;
  sponsors: SponsorListItem[];
  /** The assistant's Ask, the bar's last control (null when not offered). */
  ask: ReactNode;
  onChange: (patch: BlockPatch) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onFillPage: (align: PageAlign) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
}) {
  // On a cover (a sponsor, say: not a cover item) the bar is placed like the
  // cover items' bars, clear of the inspector and the standing tools, and kept
  // there through pans and focus scrolls (#369).
  const barRef = useBarFit<HTMLDivElement>(!cover);
  useCoverToolbarBounds(barRef, Boolean(cover));
  const chromeTop = bleed
    ? "top-2 [transform-origin:top_left]"
    : "bottom-full mb-2";
  return (
    <>
      {block.type === "image" ? (
        <div
          data-block-bar
          ref={barRef}
          className={`border-hair chrome-unscaled absolute z-20 flex w-max flex-wrap items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)] ${chromeTop} ${bleed ? "left-11" : "left-0"}`}
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
                onFillPage={onFillPage}
              />
              <BarRule />
              <AltControl
                alt={block.alt ?? ""}
                onChange={(alt) => onChange({ alt })}
              />
            </>
          )}
          {ask}
        </div>
      ) : block.type === "montage" ? (
        <div
          data-block-bar
          ref={barRef}
          className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex w-max flex-wrap items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
        >
          <MontageBlockControl
            items={block.items}
            caption={block.caption}
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
          {ask}
        </div>
      ) : block.type === "video" ? (
        <div
          data-block-bar
          ref={barRef}
          className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex w-max flex-wrap items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
        >
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
          {ask}
        </div>
      ) : block.type === "text" && !cover ? (
        // The text block's toolbar (size + formatting) lives inside the
        // rich-text editor below, so nothing is rendered here.
        <></>
      ) : block.type === "heading" && !cover ? (
        <div
          data-block-bar
          ref={barRef}
          className="chrome-unscaled absolute bottom-full left-0 z-20 mb-2 w-max"
        >
          <HeadingLevelControl
            level={block.level ?? "main"}
            onChange={onChange}
            trailing={ask}
          />
        </div>
      ) : block.type === "sponsor" ? (
        <div
          data-block-bar
          ref={barRef}
          className="border-hair chrome-unscaled absolute bottom-full left-0 z-20 mb-2 flex w-max flex-wrap items-center gap-2.5 rounded-[8px] border bg-white px-2.5 py-1.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
        >
          <SponsorPicker
            sponsorId={block.sponsorId}
            sponsors={sponsors}
            onChange={onChange}
          />
          {ask}
        </div>
      ) : (
        // A bare type label: Ask sits right beside it, in the same chrome.
        <div
          data-block-bar
          className="chrome-unscaled absolute bottom-full left-0 z-10 mb-2 flex items-center gap-1.5"
        >
          <span className="bg-accent text-paper rounded-[3px] px-1.5 py-[3px] font-sans text-[9px] font-semibold tracking-[0.1em] uppercase">
            {block.type}
          </span>
          {ask}
        </div>
      )}
      <div
        className={`absolute z-10 ${
          // Bottom corner on a filled page: the top one is where the
          // block's own tool bar lands, at whatever zoom.
          bleed ? "right-2 bottom-2.5" : "top-1/2 -right-9 -translate-y-1/2"
        }`}
      >
        <div
          className="chrome-unscaled flex flex-col gap-1"
          style={{
            transformOrigin: bleed ? "bottom right" : "center left",
          }}
        >
          <Ctrl icon="arrowUp" title="Move up" onClick={() => onMove(-1)} />
          <Ctrl icon="arrowDown" title="Move down" onClick={() => onMove(1)} />
          <Ctrl icon="trash" title="Delete" danger onClick={onRemove} />
        </div>
      </div>
    </>
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
