"use client";

import { Button, IconButton } from "@/components/ui";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { MIN_ZOOM, MAX_ZOOM } from "@/features/blocks/use-canvas-pan-zoom";
import type { PdfState } from "./use-issue-pdf";

/** One press of the zoom buttons, as a factor. */
const ZOOM_STEP = 0.15;

// The reader's top bar: the way back to the library, what is open, and the
// controls that change how the issue is presented — the layout theme, the
// PDF, full screen. Dark chrome on the ground, like every bar in the app.
export function ReaderTopBar({
  magazineName,
  issueNo,
  themes,
  themeId,
  onSelectTheme,
  pdfEnabled,
  pdfState,
  onDownloadPdf,
  isFullscreen,
  onToggleFullscreen,
}: {
  magazineName: string;
  issueNo: number;
  /** The deployment-enabled layout themes; the toggle hides with only one. */
  themes: LayoutTheme[];
  themeId: LayoutThemeId;
  onSelectTheme: (id: LayoutThemeId) => void;
  /** Whether the owner offers PDF downloads at all (issue #162) — resolved from
   *  the magazine settings on the server. False drops the control entirely;
   *  there is no disabled state to find. */
  pdfEnabled: boolean;
  pdfState: PdfState;
  onDownloadPdf: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const pdfTitle =
    pdfState === "loading"
      ? "Preparing PDF…"
      : pdfState === "error"
        ? "PDF failed — tap to retry"
        : "Download PDF";
  return (
    <header className="border-hairline bg-raised flex h-14 flex-none items-center justify-between gap-3 border-b px-3">
      <Button
        href="/"
        variant="ghost"
        tone="dark"
        size="sm"
        icon="arrowLeft"
        iconPosition="left"
      >
        Library
      </Button>
      <div className="text-chrome-text min-w-0 truncate font-display text-[17px]">
        {magazineName}
        <span className="text-chrome-muted ml-2.5 font-meta text-[12px] tracking-[0.1em] uppercase">
          No. {issueNo}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* Only offer the toggle when the deployment enables more than one
            layout theme (NEXT_PUBLIC_ISSUE_THEMES) — with a single theme
            there's nothing to choose. */}
        {themes.length > 1 && (
          <div
            role="group"
            aria-label="Theme"
            className="border-hairline mr-2 flex rounded-[7px] border p-[3px]"
          >
            {themes.map((t) => {
              const on = t.id === themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  aria-pressed={on}
                  className={`flex h-9 cursor-pointer items-center rounded-[4px] px-3.5 font-ui text-[14px] font-medium transition-colors ${
                    on
                      ? "bg-brass text-ground"
                      : "text-chrome-muted hover:bg-lifted hover:text-chrome-text"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
        {pdfEnabled && (
          <Button
            variant="ghost"
            tone="dark"
            size="sm"
            icon="download"
            iconPosition="left"
            busy={pdfState === "loading"}
            title={pdfTitle}
            aria-label={pdfTitle}
            onClick={onDownloadPdf}
            className={pdfState === "error" ? "text-danger-bright" : ""}
          >
            <span className="hidden lg:inline">
              {pdfState === "loading"
                ? "Preparing…"
                : pdfState === "error"
                  ? "Retry PDF"
                  : "Download PDF"}
            </span>
          </Button>
        )}
        <IconButton
          icon={isFullscreen ? "fullscreenExit" : "fullscreen"}
          label={isFullscreen ? "Exit full screen" : "Full screen"}
          tone="dark"
          onClick={onToggleFullscreen}
        />
      </div>
    </header>
  );
}

// The reader's bottom bar: paging with the spread counter between two big
// labelled buttons, the contents toggle, and zoom (out / slider / in / fit).
// Always visible and always the same height — a bar, not a dock that fades.
export function ReaderControls({
  label,
  onPrev,
  onNext,
  contentsOpen,
  onToggleContents,
  onResetView,
  zoom,
  onZoom,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  contentsOpen: boolean;
  onToggleContents: () => void;
  onResetView: () => void;
  zoom: number;
  onZoom: (next: number) => void;
}) {
  const step = (dir: -1 | 1) =>
    onZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + dir * ZOOM_STEP)));
  return (
    <div className="border-hairline bg-raised flex h-16 flex-none items-center justify-between gap-3 border-t px-3">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          tone="dark"
          size="sm"
          icon="chevronLeft"
          iconPosition="left"
          title="Previous"
          aria-label="Previous"
          onClick={onPrev}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="text-chrome-muted min-w-[84px] text-center font-meta text-[13px] tabular-nums">
          {label}
        </span>
        <Button
          variant="secondary"
          tone="dark"
          size="sm"
          icon="chevronRight"
          title="Next"
          aria-label="Next"
          onClick={onNext}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          icon="menu"
          label="Contents"
          title="Contents"
          showLabel
          tone="dark"
          aria-pressed={contentsOpen}
          onClick={onToggleContents}
        />
        <span className="bg-hairline mx-1 h-6 w-px" aria-hidden />
        <IconButton
          icon="minus"
          label="Zoom out"
          tone="dark"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => step(-1)}
        />
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(e) => onZoom(parseFloat(e.target.value))}
          aria-label="Zoom page"
          title={`Zoom ${Math.round(zoom * 100)}%`}
          className="accent-brass h-1 w-20 cursor-pointer"
        />
        <IconButton
          icon="plus"
          label="Zoom in"
          tone="dark"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => step(1)}
        />
        <IconButton
          icon="fitScreen"
          label="Fit to screen"
          title="Fit to screen"
          tone="dark"
          onClick={onResetView}
        />
      </div>
    </div>
  );
}
