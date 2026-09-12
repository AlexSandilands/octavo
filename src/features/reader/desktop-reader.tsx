"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { IssueContent } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import {
  defaultEnabledThemeId,
  enabledThemes,
  getTheme,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { ReaderSpread, FLIP_MS, type Turn } from "./reader-spread";
import { ReaderContents, buildToc } from "./reader-contents";
import { ReaderControls } from "./reader-controls";
import { useIssuePdf } from "./use-issue-pdf";

// The page-turn strip inside each outer edge of the spread, as a fraction of the
// spread's width: ~40–55px on a fitted spread; scales with zoom since it is read
// off the live box.
const EDGE_BAND = 0.05;

export function DesktopReader({
  content,
  issueNo,
  routeNumber,
  logo,
  settings,
  images,
  sponsors,
  fillHeight = false,
}: {
  content: IssueContent;
  issueNo: number;
  routeNumber: number;
  /** The issue's footer mark (issue #97), or null for the text-only footer. */
  logo: ResolvedImage | null;
  /** The magazine's effective branding + footer appearance (issue #105),
   *  resolved on the server and threaded down to the page chrome. */
  settings: SiteSettings;
  images: ImageMap;
  sponsors: SponsorMap;
  /** Fill a bounded preview pane; the public reader still owns the viewport. */
  fillHeight?: boolean;
}) {
  const pages = content.pages;
  const toc = buildToc(pages);

  const [spread, setSpread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  // The reader's layout theme is a member-facing per-session preference (not the
  // issue's stored theme): it opens on the deployment default and the toggle
  // offers only the enabled themes. `themeId` is the choice; `theme` the module.
  const themes = enabledThemes();
  const [themeId, setThemeId] = useState<LayoutThemeId>(
    defaultEnabledThemeId(),
  );
  const theme = getTheme(themeId);
  // The PDF renders in whichever theme is currently on screen. Called whether
  // or not the owner offers downloads (issue #162) — hooks can't be
  // conditional, and it costs nothing until something calls `download`; only
  // the control below is conditional.
  const pdf = useIssuePdf(routeNumber, issueNo, themeId);

  // Page-turn animation. `turn` holds the in-flight flip (direction + target
  // spread); the curl itself (TurnCurl) owns the Web Animations that carry it
  // from 0 to landed. While a turn runs, pan/zoom/new turns are blocked.
  // `spreadRef` measures the spread box for edge-zone hits, and is also the
  // recentre element a cover turn animates (passed down as `recentreRef`).
  const [turn, setTurn] = useState<Turn | null>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  // Safety net: commits the turn even if TurnCurl's finish promise never
  // resolves (a cancelled/dropped animation). Cleared on commit and unmount.
  const safetyTimer = useRef<number | null>(null);
  const clearSafetyTimer = () => {
    if (safetyTimer.current !== null) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  };
  useEffect(() => clearSafetyTimer, []);

  // Full-screen reading: requests browser fullscreen on the reader root and, for
  // a distraction-free view, collapses the contents sidebar too.
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      rootRef.current?.requestFullscreen?.();
      setCollapsed(true);
    }
  };

  // Fit-and-zoom the spine-centred spread to the stage. The page is a fixed
  // PAGE_W×PAGE_H canvas; the hook fits the full spread (2·PAGE_W) to the stage,
  // then wheel/drag zoom+pan ride on top. Pan is deliberately preserved across
  // page turns (Fit recenters); the mid-turn guard blocks zoom/drag while a leaf
  // is flipping. (Accessibility: the mobile reader reflows; here, zoom magnifies.)
  // Destructured: property access on the returned object would read through
  // the ref it carries, which the render can't do.
  const {
    containerRef: stageRef,
    panRef,
    scale,
    zoom,
    panning,
    applyZoom,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeClickSuppression,
  } = useCanvasPanZoom({
    contentWidth: 2 * PAGE_W,
    contentHeight: PAGE_H,
    fitMargin: { x: 48, y: 72 },
    fitClamp: { min: 0.4, max: Infinity },
    initialFitScale: 0.7,
    blockSelector: '[data-reader-block]:not([data-reader-block="bleed"])',
    isBlocked: () => Boolean(turn),
  });

  // Like a real magazine, the cover (page 1) stands alone, then the rest pair up
  // into spreads: view 0 = [cover], view k≥1 = pages 2k & 2k+1.
  const n = pages.length;
  const isCover = spread === 0;
  const leftIdx = isCover ? 0 : 2 * spread - 1;
  const leftNo = leftIdx + 1;
  const maxSpread = n <= 1 ? 0 : Math.ceil((n - 1) / 2);
  const label = isCover
    ? `1 / ${n}`
    : leftNo + 1 <= n
      ? `${leftNo}–${leftNo + 1} / ${n}`
      : `${leftNo} / ${n}`;
  const viewOf = (page: number) => (page <= 1 ? 0 : Math.ceil((page - 1) / 2));
  const go = (page: number) => setSpread(viewOf(page));

  // The cover reads as a single, centred page rather than the right leaf of a
  // blank spread. The spread box stays a constant 2·PAGE_W (so the curl geometry
  // and the pan-zoom fit never change); when the view we're settling into is the
  // cover we translate the box left by a quarter of its width — half a page — so
  // the cover lands centred, and the first turn animates that offset back to 0
  // (recenter) as the leaf curls. `targetView` looks ahead to the turn's
  // destination so the recenter runs during the turn, not after it commits.
  const targetView = turn ? turn.to : spread;
  const atCover = targetView === 0;

  // Turn one spread forward/back with the page-curl (TurnCurl): it owns the
  // Web Animations and calls onTurnEnd when they land. A reduced-motion
  // preference skips all of it and swaps instantly.
  const startTurn = (dir: "next" | "prev") => {
    if (turn) return;
    const to = dir === "next" ? spread + 1 : spread - 1;
    if (to < 0 || to > maxSpread) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setSpread(to);
      return;
    }
    setTurn({ dir, to });
    safetyTimer.current = window.setTimeout(() => {
      safetyTimer.current = null;
      setSpread(to);
      setTurn(null);
    }, FLIP_MS + 500);
  };

  // Commits the turn once the curl's animations finish: adopt the destination
  // spread and clear `turn`, cancelling the safety net above.
  const onTurnEnd = () => {
    clearSafetyTimer();
    if (!turn) return;
    setSpread(turn.to);
    setTurn(null);
  };

  // Keyboard paging (WCAG 2.1.1): arrow keys turn the spread. An effect event
  // so the once-bound window listener always calls the latest closure without
  // re-binding on every state change.
  const turnByKey = useEffectEvent((dir: "next" | "prev") => startTurn(dir));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Leave arrows aimed at a form control alone (e.g. the zoom slider).
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        turnByKey("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        turnByKey("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The page-turn hitbox: a thin strip inside each outer edge of the spread,
  // running outwards over the whole stage. On click rather than press, so a drag
  // that starts in the strip pans instead of turning.
  const onStageClick = (e: React.MouseEvent) => {
    if (consumeClickSuppression()) return;
    const target = e.target as HTMLElement;
    // A link stays clickable, and a click on page content must reach that block
    // so text near a page edge can be selected. A full-bleed photo ("bleed") is
    // the exception: it *is* the page, and has nothing to select.
    if (target.closest("a")) return;
    const block = target.closest("[data-reader-block]");
    if (block && block.getAttribute("data-reader-block") !== "bleed") return;
    const rect = spreadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const edge = rect.width * EDGE_BAND;
    if (e.clientX >= rect.right - edge) startTurn("next");
    else if (e.clientX <= rect.left + edge) startTurn("prev");
  };

  return (
    <div
      ref={rootRef}
      className={`bg-stage relative flex overflow-hidden ${
        fillHeight ? "h-full" : "h-screen"
      }`}
    >
      {/* Only offer the toggle when the deployment enables more than one layout
          theme (NEXT_PUBLIC_ISSUE_THEMES) — with a single theme there's nothing
          to choose. */}
      {themes.length > 1 && (
        <div className="absolute top-3.5 right-4 z-10 flex items-center gap-2">
          <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.18em] uppercase">
            Theme
          </span>
          <div className="bg-card border-hair flex rounded-full border p-[3px]">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                aria-pressed={themeId === t.id}
                className={`flex min-h-[44px] items-center rounded-full px-4 font-sans text-xs font-semibold ${
                  themeId === t.id ? "bg-accent text-paper" : "text-muted"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <ReaderContents
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        toc={toc}
        spread={spread}
        issueNo={issueNo}
        magazineName={settings.name}
        viewOf={viewOf}
        onNavigate={go}
      />

      <div
        ref={stageRef}
        onClick={onStageClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex-1 overflow-hidden ${
          panning ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-6">
          {/* Pan rides on the outer wrapper (instant); the cover-recenter offset
              rides on the inner one. At rest it's a CSS transition so a drag
              never lags behind a 700ms ease; mid-turn TurnCurl drives it on
              the curl's own timeline instead (turn-curl-animate.ts), so the
              transition classes stand down. The offset is a percentage of the
              box's own width, so a zoom rescales it instantly without a stray
              transition. */}
          <div ref={panRef} className="relative">
            <div
              ref={spreadRef}
              // `flex`, not `inline-flex`: mid-turn every child is absolutely
              // positioned, and an inline-level box would then synthesise a
              // baseline and jump the spread for the turn's duration (#217).
              className={`relative flex ${
                turn
                  ? ""
                  : "transition-transform duration-700 ease-[cubic-bezier(0.3,0.1,0.2,1)] motion-reduce:transition-none"
              }`}
              style={{ transform: `translateX(${atCover ? "-25%" : "0%"})` }}
            >
              <ReaderSpread
                pages={pages}
                spread={spread}
                turn={turn}
                onTurnEnd={onTurnEnd}
                theme={theme}
                scale={scale}
                issueNo={issueNo}
                logo={logo}
                settings={settings}
                images={images}
                sponsors={sponsors}
                recentreRef={spreadRef}
              />
            </div>
          </div>
        </div>
      </div>

      <ReaderControls
        label={label}
        onPrev={() => startTurn("prev")}
        onNext={() => startTurn("next")}
        onToggleContents={() => setCollapsed((c) => !c)}
        onResetView={resetView}
        zoom={zoom}
        onZoom={applyZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        pdfEnabled={settings.pdfDownloads}
        pdfState={pdf.state}
        onDownloadPdf={pdf.download}
      />
    </div>
  );
}
