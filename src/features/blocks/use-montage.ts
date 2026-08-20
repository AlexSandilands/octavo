"use client";

import { useEffect, useState, type RefObject } from "react";
import { MONTAGE_MANUAL } from "@/lib/blocks";

// The montage's timing rules, kept out of the widget so the component stays
// presentational (issue #95). Autoplay is deliberately conservative — it runs
// only when every one of these holds:
//
//   * there is more than one slide, and the block asked for a timer at all
//     (interval MONTAGE_MANUAL = "manual only" turns autoplay off entirely);
//   * the block is actually on screen. The mobile reader renders the whole
//     issue as one column, so without this every montage in a long issue would
//     tick in the background; the desktop flipbook already unmounts offscreen
//     spreads, and a mid-turn leaf rotates edge-on and stops intersecting;
//   * the tab is foregrounded (IntersectionObserver does not fire on a tab
//     switch, so page-visibility is checked separately);
//   * the reader is not interacting — pointer over or focus inside the widget;
//   * prefers-reduced-motion is not set. A reduced-motion reader gets no
//     movement they did not ask for; the arrows still work.
//
// Pressing an arrow hands control to the reader for good (for the life of this
// mount): a montage that resumed advancing under someone stepping through it
// would fight them. This follows the WAI carousel guidance that auto-rotation
// stops once the user takes over.

export type Montage = {
  index: number;
  /** True while a timer is actually running, for the widget's live-region hint. */
  playing: boolean;
  next: () => void;
  prev: () => void;
  /** Pointer/focus handlers the widget spreads onto its root. */
  interaction: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
};

export function useMontage(
  ref: RefObject<HTMLElement | null>,
  count: number,
  intervalSeconds: number,
): Montage {
  const [rawIndex, setRawIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const onScreen = useOnScreen(ref);
  const tabVisible = usePageVisible();
  const reduceMotion = usePrefersReducedMotion();

  // The slide list can shrink under us (the editor's live preview, or an
  // autosave round-trip that dropped a deleted image), so the legal index is
  // derived — the raw one is clamped wherever it is read.
  const clamp = (i: number) => (count > 0 ? Math.min(i, count - 1) : 0);
  const index = clamp(rawIndex);

  const playing =
    count > 1 &&
    intervalSeconds > MONTAGE_MANUAL &&
    !manual &&
    !interacting &&
    onScreen &&
    tabVisible &&
    !reduceMotion;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setRawIndex((i) => (Math.min(i, count - 1) + 1) % count),
      intervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [playing, intervalSeconds, count]);

  const step = (dir: 1 | -1) => {
    if (count === 0) return;
    setManual(true);
    setRawIndex((i) => (clamp(i) + dir + count) % count);
  };

  return {
    index,
    playing,
    next: () => step(1),
    prev: () => step(-1),
    interaction: {
      onPointerEnter: () => setInteracting(true),
      onPointerLeave: () => setInteracting(false),
      onFocus: () => setInteracting(true),
      onBlur: () => setInteracting(false),
    },
  };
}

// Whether the element is at all within the viewport. Starts false so a montage
// far down a long mobile issue never runs a timer before it is scrolled to.
function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (a very old browser): assume visible, so the
    // montage degrades to plain autoplay rather than never advancing. The
    // one-time set stands in for the observer's first delivery.
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return onScreen;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

// Live, so toggling the OS/browser setting (or emulating it in a verification
// run) takes effect without a reload.
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}
