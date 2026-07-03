"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { site } from "@/lib/site";
import type { IssueContent, Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockView, type Theme } from "@/features/blocks/block-view";
import { blockFlowStyle } from "@/features/blocks/layout";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const FLIP_MS = 700;

type TocEntry = { label: string; page: number };

function buildToc(pages: Page[]): TocEntry[] {
  const toc: TocEntry[] = [];
  pages.forEach((p, i) => {
    for (const b of p.blocks) {
      // Run-in paragraph sub-heads are too granular for the contents list.
      if (
        b.type === "heading" &&
        b.title.trim() &&
        (b.level ?? "main") !== "paragraph"
      ) {
        toc.push({ label: b.title, page: i + 1 });
      }
    }
  });
  return toc;
}

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
  const [theme, setTheme] = useState<Theme>("Classic");

  // Page-turn animation. `turn` holds the in-flight flip (direction + target
  // spread); `turnAngle` is the leaf's live rotation that CSS transitions from 0
  // to ±180°. While a turn runs, pan/zoom/new turns are blocked. The spine page
  // turn is a single rotating leaf over the destination spread rendered beneath —
  // see renderTurn(). `spreadRef` measures the spread box for edge-zone hits.
  const [turn, setTurn] = useState<{ dir: "next" | "prev"; to: number } | null>(
    null,
  );
  const [turnAngle, setTurnAngle] = useState(0);
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

  // The page is a fixed PAGE_W×PAGE_H canvas; we only ever pick a scale that
  // fits the spread to the stage, then `zoom` multiplies it. Everything on the
  // page — type, images, spacing — scales together, so resizing never breaks the
  // layout. (Accessibility: the mobile reader reflows; here, zoom magnifies.)
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.7);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const availH = el.clientHeight - 72;
      const availW = el.clientWidth - 48;
      const s = Math.min(availH / PAGE_H, availW / (2 * PAGE_W));
      setFitScale(Math.max(0.4, s));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale * zoom;

  // Free pan: the spread is translated by `pan` (px) on top of the fitted scale,
  // so it can be dragged anywhere on the canvas, and wheel-zoom keeps the point
  // under the cursor fixed. Dragging starts only on blank areas (the stage gutter
  // or empty page space); a pointer-down on a text/image block falls through so
  // the content stays selectable. Latest values are mirrored into refs for the
  // native (non-passive) wheel handler, which can't close over fresh state.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const fitScaleRef = useRef(fitScale);

  // Keep at least a sliver of the spread on screen so it can't be lost.
  const clampPan = (p: { x: number; y: number }, zoomVal: number) => {
    const el = stageRef.current;
    if (!el) return p;
    const sc = fitScaleRef.current * zoomVal;
    const spreadW = 2 * PAGE_W * sc;
    const spreadH = PAGE_H * sc;
    const keep = 90;
    const maxX = Math.max(0, (spreadW + el.clientWidth) / 2 - keep);
    const maxY = Math.max(0, (spreadH + el.clientHeight) / 2 - keep);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  };

  // Zoom to `next`, holding a focal point (offset from the stage centre, in px)
  // fixed. The slider/reset use the centre; the wheel passes the cursor.
  const applyZoom = (nextRaw: number, focalX = 0, focalY = 0) => {
    const prev = zoomRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextRaw));
    if (next === prev) return;
    const f = next / prev;
    const p = panRef.current;
    setZoom(next);
    setPan(
      clampPan(
        { x: f * p.x + (1 - f) * focalX, y: f * p.y + (1 - f) * focalY },
        next,
      ),
    );
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (turnRef.current) return;
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left - rect.width / 2;
      const focalY = e.clientY - rect.top - rect.height / 2;
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0015), focalX, focalY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // applyZoom reads refs, so it never goes stale; bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-drag to move the spread, started only on blank areas (see onPanDown).
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const onPanDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || turn) return;
    // Let text/image blocks handle their own pointer (selection); only blank
    // page space and the stage gutter start a drag. (Edge-zone flip hits are
    // caught earlier, on the spread box — see its onPointerDown.)
    if ((e.target as HTMLElement).closest("[data-reader-block]")) return;
    const el = stageRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    el.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPanMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPan(
      clampPan(
        { x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) },
        zoom,
      ),
    );
  };
  const onPanUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setPanning(false);
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };

  // Like a real magazine, the cover (page 1) stands alone, then the rest pair up
  // into spreads: view 0 = [cover], view k≥1 = pages 2k & 2k+1.
  const n = pages.length;
  const isCover = spread === 0;

  // Mirror the latest values for the native wheel handler / clampPan. Pan is
  // deliberately preserved across page turns, so the reader keeps the position
  // they dragged to (the Fit button recenters).
  zoomRef.current = zoom;
  panRef.current = pan;
  fitScaleRef.current = fitScale;

  const leftIdx = isCover ? 0 : 2 * spread - 1;
  const left = pages[leftIdx];
  const right = isCover ? undefined : pages[leftIdx + 1];
  const maxSpread = n <= 1 ? 0 : Math.ceil((n - 1) / 2);
  const leftNo = leftIdx + 1;
  const label = isCover
    ? `1 / ${n}`
    : leftNo + 1 <= n
      ? `${leftNo}–${leftNo + 1} / ${n}`
      : `${leftNo} / ${n}`;
  const viewOf = (page: number) => (page <= 1 ? 0 : Math.ceil((page - 1) / 2));
  const go = (page: number) => setSpread(viewOf(page));

  // Turn one spread forward/back with the page-curl animation. Transitions that
  // involve the standalone cover (a width change) or a reduced-motion preference
  // just swap instantly; everything else animates a single leaf over the
  // destination spread, then commits when the leaf lands.
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
    setTurnAngle(0);
    // Two frames so the leaf paints flat (0°) before the transition to ±180°.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTurnAngle(dir === "next" ? -180 : 180)),
    );
    turnTimer.current = window.setTimeout(() => {
      turnTimer.current = null;
      setSpread(to);
      setTurn(null);
      setTurnAngle(0);
    }, FLIP_MS + 30);
  };

  // A press in the left/right edge band of the spread flips that way (like
  // grabbing the corner of a real page); presses elsewhere fall through to pan.
  const onSpreadPointerDown = (e: React.PointerEvent) => {
    if (turn) return;
    // A link in the edge band must stay clickable — don't hijack it for a turn.
    if ((e.target as HTMLElement).closest("a")) return;
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

  // The animated spread: the destination spread painted beneath, the current
  // non-moving page on top, and a single leaf rotating around the spine from the
  // moving half (front = the current page, back = a blank themed page).
  const renderTurn = () => {
    if (!turn) return null;
    const pageW = PAGE_W * scale;
    const pageH = PAGE_H * scale;
    const s = spread;
    const fwd = turn.dir === "next";
    const clIdx = 2 * s - 1; // current left
    const crIdx = 2 * s; // current right
    const baseLeftIdx = fwd ? 2 * s + 1 : 2 * s - 3;
    const baseRightIdx = fwd ? 2 * s + 2 : 2 * s - 2;

    const layer = (idx: number, side: "left" | "right", x: number) => (
      <div style={{ position: "absolute", top: 0, left: x }}>
        <PageView
          page={pages[idx]}
          side={side}
          theme={theme}
          scale={scale}
          issueNo={issueNo}
          pageNo={idx + 1}
          images={images}
          sponsors={sponsors}
        />
      </div>
    );

    // Front of the leaf is the current moving page; its back is the destination
    // page that the leaf lands on, so the turn resolves seamlessly into the
    // committed spread.
    const frontIdx = fwd ? crIdx : clIdx;
    const backIdx = fwd ? baseLeftIdx : baseRightIdx;
    const backSide = fwd ? "left" : "right";

    return (
      <div
        style={{
          position: "relative",
          width: 2 * pageW,
          height: pageH,
          perspective: 2200,
        }}
      >
        {layer(baseLeftIdx, "left", 0)}
        {layer(baseRightIdx, "right", pageW)}
        {fwd ? layer(clIdx, "left", 0) : layer(crIdx, "right", pageW)}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: fwd ? pageW : 0,
            width: pageW,
            height: pageH,
            zIndex: 5,
            transformStyle: "preserve-3d",
            transformOrigin: fwd ? "left center" : "right center",
            transform: `rotateY(${turnAngle}deg)`,
            transition: `transform ${FLIP_MS}ms cubic-bezier(0.3, 0.1, 0.2, 1)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
            }}
          >
            <PageView
              page={pages[frontIdx]}
              side={fwd ? "right" : "left"}
              theme={theme}
              scale={scale}
              issueNo={issueNo}
              pageNo={frontIdx + 1}
              images={images}
              sponsors={sponsors}
            />
          </div>
          <div
            className="bg-page"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <PageView
              page={pages[backIdx]}
              side={backSide}
              theme={theme}
              scale={scale}
              issueNo={issueNo}
              pageNo={backIdx + 1}
              images={images}
              sponsors={sponsors}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="bg-stage relative flex h-screen overflow-hidden"
    >
      <div className="absolute top-3.5 right-4 z-10 flex items-center gap-2">
        <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.18em] uppercase">
          Theme
        </span>
        <div className="bg-card border-hair flex rounded-full border p-[3px]">
          {(["Classic", "Modern"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-full px-3.5 py-[5px] font-sans text-xs font-semibold ${
                theme === t ? "bg-accent text-paper" : "text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {collapsed ? (
        <aside className="bg-card border-line flex w-[54px] flex-none flex-col items-center gap-4 border-r py-5">
          <Link
            href="/"
            title="Back to library"
            className="text-muted hover:text-accent"
          >
            <Icon name="chevronLeft" size={20} />
          </Link>
          <div className="bg-line h-px w-6" />
          <button
            onClick={() => setCollapsed(false)}
            className="text-accent"
            title="Expand contents"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="bg-line h-px w-6" />
          <span className="text-faint2 font-mono text-[10px] tracking-[0.1em] [writing-mode:vertical-rl]">
            CONTENTS
          </span>
        </aside>
      ) : (
        <aside className="bg-card border-line flex w-[248px] flex-none flex-col border-r py-5">
          <Link
            href="/"
            className="text-muted hover:text-accent mb-4 flex items-center gap-1.5 px-5 font-sans text-[13px] font-medium"
          >
            <Icon name="chevronLeft" size={16} />
            Library
          </Link>
          <div className="flex items-center justify-between px-5">
            <span className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
              Contents
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted"
              title="Collapse"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
          </div>
          <p className="text-faint px-5 pt-2 font-serif text-[13px] italic">
            {site.name} · No. {issueNo}
          </p>
          <div className="bg-line mx-5 my-4 h-px" />
          <nav className="flex-1 overflow-auto">
            {toc.length === 0 && (
              <p className="text-faint2 px-5 font-sans text-[13px]">
                Headings appear here.
              </p>
            )}
            {toc.map((t) => {
              const active = viewOf(t.page) === spread;
              return (
                <button
                  key={`${t.page}-${t.label}`}
                  onClick={() => go(t.page)}
                  className="flex w-full items-baseline justify-between gap-2.5 border-l-2 px-5 py-2.5 text-left"
                  style={{ borderColor: active ? "#1d4d3e" : "transparent" }}
                >
                  <span
                    className="font-serif text-[15px] leading-snug"
                    style={{ color: active ? "#1d4d3e" : "#2a2722" }}
                  >
                    {t.label}
                  </span>
                  <span className="text-faint2 font-mono text-[11px]">
                    {t.page}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div
        ref={stageRef}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
        className={`relative flex-1 overflow-hidden ${
          panning ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-6">
          <div
            ref={spreadRef}
            onPointerDown={onSpreadPointerDown}
            className="relative inline-flex shadow-[0_18px_40px_rgba(40,36,28,0.18)]"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {turn ? (
              renderTurn()
            ) : isCover ? (
              // The cover is a single page, but it's shown as the right leaf of a
              // spine-centred spread (blank facing page) so it opens with the
              // same page-curl as every other spread — no width jump.
              <>
                <PageView
                  side="left"
                  theme={theme}
                  scale={scale}
                  issueNo={issueNo}
                  images={images}
                  sponsors={sponsors}
                />
                <PageView
                  page={left}
                  side="right"
                  theme={theme}
                  scale={scale}
                  issueNo={issueNo}
                  pageNo={1}
                  images={images}
                  sponsors={sponsors}
                />
              </>
            ) : (
              <>
                <PageView
                  page={left}
                  side="left"
                  theme={theme}
                  scale={scale}
                  issueNo={issueNo}
                  pageNo={leftNo}
                  images={images}
                  sponsors={sponsors}
                />
                <PageView
                  page={right}
                  side="right"
                  theme={theme}
                  scale={scale}
                  issueNo={issueNo}
                  pageNo={leftNo + 1}
                  images={images}
                  sponsors={sponsors}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="group absolute inset-x-0 bottom-0 flex justify-center px-4 pt-12 pb-4">
        <div className="flex items-center gap-1.5 rounded-full bg-[#211f1a] px-2.5 py-2 text-[#e7e2d6] opacity-20 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <CtrlBtn onClick={() => startTurn("prev")} title="Previous">
            <Icon name="chevronLeft" size={18} strokeWidth={1.7} />
          </CtrlBtn>
          <span className="min-w-[76px] text-center font-sans text-[13px] text-[#cfc9bb]">
            {label}
          </span>
          <CtrlBtn onClick={() => startTurn("next")} title="Next">
            <Icon name="chevronRight" size={18} strokeWidth={1.7} />
          </CtrlBtn>
          <Divider />
          <CtrlBtn onClick={() => setCollapsed((c) => !c)} title="Contents">
            <Icon name="menu" size={18} />
          </CtrlBtn>
          <div className="flex items-center gap-2 pr-1 pl-1">
            <CtrlBtn onClick={resetView} title="Fit to screen">
              <Icon name="zoom" size={18} />
            </CtrlBtn>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => applyZoom(parseFloat(e.target.value))}
              aria-label="Zoom page"
              title={`Zoom ${Math.round(zoom * 100)}%`}
              className="h-1 w-20 cursor-pointer"
              style={{ accentColor: "#9db8ac" }}
            />
          </div>
          <Divider />
          <CtrlBtn title="Download PDF">
            <Icon name="download" size={17} />
          </CtrlBtn>
          <CtrlBtn
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            <Icon
              name={isFullscreen ? "fullscreenExit" : "fullscreen"}
              size={17}
            />
          </CtrlBtn>
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full hover:bg-[#34312a]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-[22px] w-px bg-[#413d35]" />;
}

function PageView({
  page,
  side,
  theme,
  scale,
  issueNo,
  pageNo,
  images,
  sponsors,
}: {
  page?: Page;
  side: "left" | "right";
  theme: Theme;
  scale: number;
  issueNo: number;
  pageNo?: number;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  return (
    <ScaledPage scale={scale}>
      <PageFrame
        theme={theme}
        w={PAGE_W}
        h={PAGE_H}
        issueNo={issueNo}
        pageNo={page ? pageNo : undefined}
        side={side}
      >
        {page && (
          <div
            className={
              page.cover
                ? "flex min-h-full flex-col justify-center"
                : "relative flow-root"
            }
          >
            {page.blocks.map((b) => (
              // Marked as content: drags started here are ignored (so text and
              // images stay selectable) and the cursor reverts to the normal
              // HTML cursor rather than the grab hand.
              <div
                key={b.id}
                data-reader-block
                className="cursor-auto"
                style={blockFlowStyle(b, page.cover)}
              >
                <BlockView
                  block={b}
                  theme={theme}
                  images={images}
                  sponsors={sponsors}
                  variant={page.cover ? "cover" : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </PageFrame>
    </ScaledPage>
  );
}
