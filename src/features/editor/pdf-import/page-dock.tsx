"use client";

import { ToolButton } from "../tool-button";

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 250;
const ZOOM_STEP = 25;

// Page and zoom controls floating over the foot of the PDF view, the way the
// editor's own tools float over the canvas. `unavailable` keeps an exhausted
// control focusable so paging to the end doesn't drop keyboard focus.
export function PageDock({
  pageNumber,
  pageCount,
  zoom,
  busy,
  onNavigate,
  onZoom,
}: {
  pageNumber: number;
  pageCount: number;
  zoom: number;
  busy: boolean;
  onNavigate: (page: number) => void;
  onZoom: (zoom: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div
        role="group"
        aria-label="PDF page and zoom"
        className="border-hair-warm pointer-events-auto flex items-center gap-1 rounded-[14px] border bg-white px-2 py-1.5 shadow-[0_8px_28px_rgba(40,36,28,0.22)]"
      >
        <ToolButton
          icon="chevronLeft"
          label="Previous PDF page"
          unavailable={busy || pageNumber <= 1}
          onClick={() => onNavigate(pageNumber - 1)}
        />
        <span
          aria-live="polite"
          className="text-ink min-w-[64px] text-center font-sans text-[13px] font-semibold tabular-nums"
        >
          {pageNumber} / {pageCount}
        </span>
        <ToolButton
          icon="chevronRight"
          label="Next PDF page"
          unavailable={busy || pageNumber >= pageCount}
          onClick={() => onNavigate(pageNumber + 1)}
        />
        <span className="bg-line mx-1 h-6 w-px" />
        <ToolButton
          icon="minus"
          label="Zoom out"
          unavailable={zoom <= ZOOM_MIN}
          onClick={() => onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
        />
        <span className="text-ink min-w-[48px] text-center font-sans text-[13px] font-semibold tabular-nums">
          {zoom}%
        </span>
        <ToolButton
          icon="plus"
          label="Zoom in"
          unavailable={zoom >= ZOOM_MAX}
          onClick={() => onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
        />
      </div>
    </div>
  );
}
