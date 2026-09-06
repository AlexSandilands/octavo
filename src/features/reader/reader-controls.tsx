"use client";

import { Icon } from "@/components/icons";
import { Button, IconButton } from "@/components/ui";
import { MIN_ZOOM, MAX_ZOOM } from "@/features/blocks/use-canvas-pan-zoom";
import type { PdfState } from "./use-issue-pdf";

const ZOOM_STEP = 0.1;

// The desktop reader's controls (Compass): two big round page-turn buttons
// floating at the stage's edges, and a control card along the foot with
// Contents, the page counter, the zoom stepper and Full screen. Rendered as
// siblings of the stage, so a press never reaches the stage's edge-turn
// handler or its pan.
export function ReaderControls({
  label,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onToggleContents,
  contentsOpen,
  onResetView,
  zoom,
  onZoom,
  isFullscreen,
  onToggleFullscreen,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onToggleContents: () => void;
  contentsOpen: boolean;
  onResetView: () => void;
  zoom: number;
  onZoom: (next: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const pct = Math.round(zoom * 100);
  const step = (dir: 1 | -1) =>
    onZoom(
      Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.round((zoom + dir * ZOOM_STEP) * 100) / 100),
      ),
    );
  return (
    <>
      <div className="absolute inset-y-0 left-4 z-10 flex items-center">
        <IconButton
          icon="chevronLeft"
          label="Previous"
          variant="solid"
          box={56}
          size={28}
          disabled={!canPrev}
          onClick={onPrev}
        />
      </div>
      <div className="absolute inset-y-0 right-4 z-10 flex items-center">
        <IconButton
          icon="chevronRight"
          label="Next"
          variant="solid"
          box={56}
          size={28}
          disabled={!canNext}
          onClick={onNext}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-4">
        <div
          role="toolbar"
          aria-label="Reader controls"
          className="bg-surface border-hairline shadow-float pointer-events-auto flex items-center gap-1 rounded-full border p-1.5"
        >
          <Button
            variant="quiet"
            size="sm"
            icon="menu"
            onClick={onToggleContents}
            aria-label={contentsOpen ? "Close contents" : "Contents"}
          >
            Contents
          </Button>
          <span
            aria-live="polite"
            className="text-fg min-w-[92px] text-center font-ui text-[16px] font-bold tabular-nums"
          >
            <span className="sr-only">Page </span>
            {label}
          </span>
          <span className="bg-hairline mx-1 h-6 w-px" aria-hidden="true" />
          <div
            role="group"
            aria-label="Zoom"
            className="flex items-center gap-1"
          >
            <IconButton
              icon="minus"
              label="Zoom out"
              size={20}
              disabled={zoom <= MIN_ZOOM}
              onClick={() => step(-1)}
            />
            <button
              type="button"
              onClick={onResetView}
              title="Fit to screen"
              aria-label={`Zoom ${pct}% — fit to screen`}
              className="text-fg-muted hover:bg-primary-wash hover:text-primary flex h-11 min-w-[60px] cursor-pointer items-center justify-center rounded-full px-1 font-ui text-[15px] font-bold tabular-nums transition-colors"
            >
              {pct}%
            </button>
            <IconButton
              icon="plus"
              label="Zoom in"
              size={20}
              disabled={zoom >= MAX_ZOOM}
              onClick={() => step(1)}
            />
          </div>
          <span className="bg-hairline mx-1 h-6 w-px" aria-hidden="true" />
          <Button
            variant="quiet"
            size="sm"
            icon={isFullscreen ? "fullscreenExit" : "fullscreen"}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>
    </>
  );
}

// The PDF button for the reader top bar: three states, one width.
export function PdfButton({
  state,
  onClick,
  size = "sm",
}: {
  state: PdfState;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const label =
    state === "loading"
      ? "Preparing…"
      : state === "error"
        ? "Retry PDF"
        : "Download";
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={onClick}
      busy={state === "loading"}
      aria-label={
        state === "error" ? "PDF failed — tap to retry" : "Download PDF"
      }
    >
      <span
        className={`inline-flex items-center gap-2 ${state === "error" ? "text-danger" : ""}`}
      >
        {state === "loading" ? (
          <span
            aria-hidden="true"
            className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
        ) : (
          <Icon name="download" size={18} strokeWidth={2} />
        )}
        {label}
      </span>
    </Button>
  );
}
