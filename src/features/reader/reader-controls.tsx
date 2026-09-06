"use client";

import Link from "next/link";
import { MenuSelect } from "@/components/menu-select";
import { Button, Wordmark } from "@/components/ui";
import { MIN_ZOOM, MAX_ZOOM } from "@/features/blocks/use-canvas-pan-zoom";
import type { LayoutThemeId } from "@/features/blocks/themes/registry";
import type { PdfState } from "./use-issue-pdf";

const ZOOM_STEP = 0.15;

// The reader's fixed toolbar: a slim masthead bar (a way back, the nameplate,
// the Look select and Full screen) over a row of labelled buttons — Contents,
// Previous / Next with the page position as text between them, Zoom − / + with
// the percentage, Fit, Download PDF. All words; nothing floats over the page.
export function ReaderToolbar({
  issueNo,
  pageLabel,
  onPrev,
  onNext,
  contentsOpen,
  onToggleContents,
  onResetView,
  zoom,
  onZoom,
  isFullscreen,
  onToggleFullscreen,
  pdfEnabled,
  pdfState,
  onDownloadPdf,
  themes,
  themeId,
  onTheme,
  hint,
  onDismissHint,
}: {
  issueNo: number;
  /** "Pages 2–3 of 12". */
  pageLabel: string;
  onPrev: () => void;
  onNext: () => void;
  contentsOpen: boolean;
  onToggleContents: () => void;
  onResetView: () => void;
  zoom: number;
  onZoom: (next: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Whether the owner offers PDF downloads at all (issue #162) — resolved from
   *  the magazine settings on the server. False drops the control entirely;
   *  there is no disabled state to find. */
  pdfEnabled: boolean;
  pdfState: PdfState;
  onDownloadPdf: () => void;
  /** The layout themes this deployment offers; the select shows only for 2+. */
  themes: { id: LayoutThemeId; name: string }[];
  themeId: LayoutThemeId;
  onTheme: (id: LayoutThemeId) => void;
  /** The first-visit keyboard hint under the toolbar. */
  hint: boolean;
  onDismissHint: () => void;
}) {
  const pdfLabel =
    pdfState === "loading"
      ? "Preparing PDF…"
      : pdfState === "error"
        ? "Retry PDF"
        : "Download PDF";
  const current = themes.find((t) => t.id === themeId)?.name ?? themeId;
  const pct = `${Math.round(zoom * 100)}%`;

  return (
    <header className="bg-sheet flex-none">
      <div className="flex h-12 items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="text-lead hover:text-red flex h-11 items-center font-ui text-[15px] font-semibold underline decoration-1 underline-offset-4"
        >
          ← Library
        </Link>
        <div className="flex min-w-0 items-baseline gap-3">
          <Wordmark size={22} />
          <span className="small-caps text-grey-soft">No. {issueNo}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Only offer the choice when the deployment enables more than one
              layout theme (NEXT_PUBLIC_ISSUE_THEMES). */}
          {themes.length > 1 && (
            <MenuSelect
              label="Look"
              current={current}
              ariaLabel="Layout look"
              items={themes.map((t) => ({
                key: t.id,
                value: t.id,
                content: t.name,
              }))}
              value={themeId}
              onSelect={onTheme}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleFullscreen}
            icon={isFullscreen ? "fullscreenExit" : "fullscreen"}
          >
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="Reading controls"
        className="rule-heavy rule-hair flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2"
      >
        <Button
          variant="secondary"
          size="sm"
          icon="menu"
          iconPosition="left"
          onClick={onToggleContents}
          aria-pressed={contentsOpen}
          aria-expanded={contentsOpen}
        >
          Contents
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon="chevronLeft"
            iconPosition="left"
            onClick={onPrev}
            title="Previous"
          >
            <span>
              Previous<span className="hidden lg:inline"> page</span>
            </span>
          </Button>
          <span
            aria-live="polite"
            className="text-lead min-w-[9ch] text-center font-ui text-[15px] font-semibold tabular-nums"
          >
            {pageLabel}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon="chevronRight"
            onClick={onNext}
            title="Next"
          >
            <span>
              Next<span className="hidden lg:inline"> page</span>
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Zoom"
            className="flex items-center gap-2"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
              unavailable={zoom <= MIN_ZOOM + 0.001}
              aria-label="Zoom out"
            >
              Zoom −
            </Button>
            <span
              aria-live="polite"
              className="text-lead min-w-[4.5ch] text-center font-ui text-[15px] tabular-nums"
            >
              {pct}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
              unavailable={zoom >= MAX_ZOOM - 0.001}
              aria-label="Zoom in"
            >
              Zoom +
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onResetView}
              title="Fit to screen"
            >
              Fit
            </Button>
          </div>
          {pdfEnabled && (
            <Button
              variant="secondary"
              size="sm"
              icon={pdfState === "loading" ? undefined : "download"}
              onClick={onDownloadPdf}
              busy={pdfState === "loading"}
              aria-label={
                pdfState === "error" ? "PDF failed — tap to retry" : undefined
              }
            >
              {pdfLabel}
              {pdfState === "loading" && (
                <span
                  aria-hidden="true"
                  className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
                />
              )}
            </Button>
          )}
        </div>
      </div>

      {hint && (
        <p className="text-grey rule-hair flex items-center gap-3 px-4 py-1.5 font-ui text-[14px]">
          <span>
            Tip: the ← and → keys turn the pages, and you can drag the page to
            move it when zoomed in.
          </span>
          <Button variant="link" size="sm" onClick={onDismissHint}>
            Got it
          </Button>
        </p>
      )}
    </header>
  );
}
