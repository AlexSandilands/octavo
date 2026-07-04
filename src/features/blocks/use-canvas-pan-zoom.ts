"use client";

import { useEffect, useRef, useState } from "react";

// Zoom bounds shared by the editor canvas and the desktop reader (and the
// reader's zoom slider). The page is a fixed-size canvas scaled to fit, then
// `zoom` multiplies that fit — so these are multipliers on the fitted view.
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 3;

type Pan = { x: number; y: number };

export type PanZoomOptions = {
  /**
   * The natural, unscaled content box fitted to the container and clamped
   * within it. The reader passes the full spread (2·PAGE_W); the editor a
   * single page (PAGE_W).
   */
  contentWidth: number;
  contentHeight: number;
  /** Px trimmed off each axis before fitting, so the content sits in a margin. */
  fitMargin: { x: number; y: number };
  /** Bounds applied to the computed fit scale. */
  fitClamp: { min: number; max: number };
  /** Seed used until the container is first measured (avoids a wrong-size flash). */
  initialFitScale: number;
  /**
   * A pointer-down inside an element matching this selector never starts a pan,
   * so blocks keep their own pointer (text selection / editing / dnd).
   */
  blockSelector: string;
  /**
   * When it returns true, wheel-zoom and drag-start are both suppressed — the
   * reader blocks them mid page-turn. Omitted ⇒ always active.
   */
  isBlocked?: () => boolean;
};

// The shared pan/zoom engine. Owns zoom/pan state, mirrors it into refs for the
// once-bound native (non-passive) wheel handler, clamps the pan so a sliver of
// the content always stays on screen, and exposes pointer handlers plus a slider
// `applyZoom` and a `resetView`. Behaviour is identical across the editor and
// reader; the differences (spread vs single page, fit margins, the mid-turn
// block) are the options above.
export function useCanvasPanZoom(opts: PanZoomOptions) {
  const { blockSelector, initialFitScale } = opts;

  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(initialFitScale);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);

  // Latest values mirrored into refs for the native wheel handler and clampPan,
  // which are bound once and can't close over fresh state.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const fitScaleRef = useRef(fitScale);
  zoomRef.current = zoom;
  panRef.current = pan;
  fitScaleRef.current = fitScale;
  // Geometry + the mid-turn guard change per render but the handlers bind once,
  // so read them through a ref to stay current.
  const geomRef = useRef(opts);
  geomRef.current = opts;
  const isBlocked = () => Boolean(geomRef.current.isBlocked?.());

  // Fit the content to the container (zoom = 1), re-measuring on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { contentWidth, contentHeight, fitMargin, fitClamp } =
        geomRef.current;
      const availH = el.clientHeight - fitMargin.y;
      const availW = el.clientWidth - fitMargin.x;
      const s = Math.min(availH / contentHeight, availW / contentWidth);
      setFitScale(Math.max(fitClamp.min, Math.min(fitClamp.max, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep at least a sliver of the content on screen so it can't be lost.
  const clampPan = (p: Pan, zoomVal: number): Pan => {
    const el = containerRef.current;
    if (!el) return p;
    const { contentWidth, contentHeight } = geomRef.current;
    const sc = fitScaleRef.current * zoomVal;
    const keep = 90;
    const maxX = Math.max(0, (contentWidth * sc + el.clientWidth) / 2 - keep);
    const maxY = Math.max(0, (contentHeight * sc + el.clientHeight) / 2 - keep);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  };

  // Zoom to `next`, holding a focal point (offset from the container centre, in
  // px) fixed. The slider/reset pass the centre; the wheel passes the cursor.
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
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isBlocked()) return;
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left - rect.width / 2;
      const focalY = e.clientY - rect.top - rect.height / 2;
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0015), focalX, focalY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // applyZoom / isBlocked read refs, so they never go stale; bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-drag to move the content, started only on blank areas (see the block
  // selector). `moved` gates a click-suppression flag the caller can read so a
  // drag that ends in a click doesn't register as one (the editor uses it to
  // avoid deselecting the current block).
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isBlocked()) return;
    suppressClick.current = false;
    if ((e.target as HTMLElement).closest(blockSelector)) return;
    const el = containerRef.current;
    if (!el) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3)
      d.moved = true;
    setPan(
      clampPan(
        { x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) },
        zoomRef.current,
      ),
    );
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.moved) suppressClick.current = true;
    drag.current = null;
    setPanning(false);
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };

  // True once if the just-ended drag actually moved, resetting the flag — lets
  // the caller swallow the click that follows a pan.
  const consumeClickSuppression = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return {
    containerRef,
    scale: fitScale * zoom,
    zoom,
    pan,
    panning,
    applyZoom,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeClickSuppression,
  };
}
