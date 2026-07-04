"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueContent } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
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

export function DesktopReader({
  content,
  issueNo,
  images,
  sponsors,
}: {
  content: IssueContent;
  issueNo: number;
  images: ImageMap;
  sponsors: SponsorMap;
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
  // The PDF renders in whichever theme is currently on screen.
  const pdf = useIssuePdf(issueNo, themeId);

  // Page-turn animation. `turn` holds the in-flight flip (direction + target
  // spread); `turnAngle` is the leaf's live rotation that CSS transitions from 0
  // to ±180°. While a turn runs, pan/zoom/new turns are blocked. `spreadRef`
  // measures the spread box for edge-zone hits.
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnAngle, setTurnAngle] = useState(0);
  // Opacity driver for the cover-open/close: the facing left leaf fades in as
  // the cover opens (0→1) and out as it closes (1→0), kicked alongside turnAngle.
  const [leftFade, setLeftFade] = useState(1);
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const spreadRef = useRef<HTMLDivElement>(null);
  // The commit timer of an in-flight page turn — cleared on unmount so it
  // can't fire setState on an unmounted reader.
  const turnTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (turnTimer.current !== null) window.clearTimeout(turnTimer.current);
    },
    [],
  );

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
  const panZoom = useCanvasPanZoom({
    contentWidth: 2 * PAGE_W,
    contentHeight: PAGE_H,
    fitMargin: { x: 48, y: 72 },
    fitClamp: { min: 0.4, max: Infinity },
    initialFitScale: 0.7,
    blockSelector: "[data-reader-block]",
    isBlocked: () => Boolean(turnRef.current),
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
  const coverTurn = Boolean(turn) && (spread === 0 || turn?.to === 0);

  // Turn one spread forward/back with the page-curl animation: a single leaf
  // rotates over the destination spread, then commits when the leaf lands. A
  // turn into or out of the cover also fades the facing leaf and recenters the
  // box (see below). A reduced-motion preference skips all of it and swaps
  // instantly.
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
    // A turn into or out of the cover fades the facing left leaf: opening
    // (turning forward off the cover) fades it in 0→1; closing (turning back to
    // the cover) fades it out 1→0. The recenter offset animates via CSS.
    const coverInvolved = spread === 0 || to === 0;
    setTurn({ dir, to });
    setTurnAngle(0);
    if (coverInvolved) setLeftFade(dir === "next" ? 0 : 1);
    // Two frames so the leaf paints flat (0°) before the transition to ±180°.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTurnAngle(dir === "next" ? -180 : 180);
        if (coverInvolved) setLeftFade(dir === "next" ? 1 : 0);
      }),
    );
    turnTimer.current = window.setTimeout(() => {
      turnTimer.current = null;
      setSpread(to);
      setTurn(null);
      setTurnAngle(0);
    }, FLIP_MS + 30);
  };

  // Keyboard paging (WCAG 2.1.1): arrow keys turn the spread. Mirrored into a ref
  // so the once-bound window listener always calls the latest closure without
  // re-binding on every state change.
  const startTurnRef = useRef(startTurn);
  startTurnRef.current = startTurn;
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
        startTurnRef.current("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        startTurnRef.current("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A press in the left/right edge band of the spread flips that way (like
  // grabbing the corner of a real page); presses elsewhere fall through to pan.
  const onSpreadPointerDown = (e: React.PointerEvent) => {
    if (turn) return;
    const target = e.target as HTMLElement;
    // A link in the edge band must stay clickable — don't hijack it for a turn.
    if (target.closest("a")) return;
    // A press on page content (text/image block) must reach that block so the
    // reader can select text near a page edge; only the bare page margins arm
    // the edge-flip. Paging otherwise stays available via the arrows/keyboard.
    if (target.closest("[data-reader-block]")) return;
    const rect = spreadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const edge = rect.width * 0.16;
    if (e.clientX >= rect.right - edge && spread < maxSpread) {
      e.stopPropagation();
      startTurn("next");
    } else if (e.clientX <= rect.left + edge && spread > 0) {
      e.stopPropagation();
      startTurn("prev");
    }
  };

  return (
    <div
      ref={rootRef}
      className="bg-stage relative flex h-screen overflow-hidden"
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
        viewOf={viewOf}
        onNavigate={go}
      />

      <div
        ref={panZoom.containerRef}
        onPointerDown={panZoom.onPointerDown}
        onPointerMove={panZoom.onPointerMove}
        onPointerUp={panZoom.onPointerUp}
        onPointerCancel={panZoom.onPointerUp}
        className={`relative flex-1 overflow-hidden ${
          panZoom.panning ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-6">
          {/* Pan rides on the outer wrapper (instant); the cover-recenter offset
              rides on the inner one (transitioned) so a drag never lags behind a
              700ms ease. The offset is a percentage of the box's own width, so a
              zoom rescales it instantly without a stray transition. */}
          <div
            className="relative"
            style={{
              transform: `translate(${panZoom.pan.x}px, ${panZoom.pan.y}px)`,
            }}
          >
            <div
              ref={spreadRef}
              onPointerDown={onSpreadPointerDown}
              className="relative inline-flex transition-transform duration-700 ease-[cubic-bezier(0.3,0.1,0.2,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${atCover ? "-25%" : "0%"})` }}
            >
              {/* Drop-shadow plate behind the pages, sized to the visible sheet:
                  the full spread, or just the cover leaf when centred. A box
                  shadow on the spread wrapper would flatten the flip's 3D, so it
                  lives on its own element. */}
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 shadow-[0_18px_40px_rgba(40,36,28,0.18)] transition-[left,width] duration-700 ease-[cubic-bezier(0.3,0.1,0.2,1)] motion-reduce:transition-none"
                style={{
                  left: atCover ? "50%" : "0%",
                  width: atCover ? "50%" : "100%",
                  height: "100%",
                }}
              />
              <ReaderSpread
                pages={pages}
                spread={spread}
                turn={turn}
                turnAngle={turnAngle}
                leftFade={coverTurn ? leftFade : undefined}
                theme={theme}
                scale={panZoom.scale}
                issueNo={issueNo}
                images={images}
                sponsors={sponsors}
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
        onResetView={panZoom.resetView}
        zoom={panZoom.zoom}
        onZoom={panZoom.applyZoom}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        pdfState={pdf.state}
        onDownloadPdf={pdf.download}
      />
    </div>
  );
}
