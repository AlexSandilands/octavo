"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { PAGE_W } from "@/features/blocks/page-frame";
import { INSPECTOR_RESERVE } from "./use-panel-dock";

/** Whether the inspector holds a column of the stage or floats over the page. */
export type InspectorMode = "reserved" | "overlay";

/** The smallest page worth reserving a column beside: half of full size. */
const MIN_RESERVED_PAGE = PAGE_W * 0.5;

// The inspector keeps its column only while the page still fits beside it at
// about half scale; on any tighter stage it gives the width back and collapses
// into its tab, floating over the page when it is opened (issue #268).
export function inspectorMode(
  stageWidth: number,
  fitMarginX: number,
): InspectorMode {
  if (!stageWidth) return "reserved";
  return stageWidth - fitMarginX - INSPECTOR_RESERVE >= MIN_RESERVED_PAGE
    ? "reserved"
    : "overlay";
}

/** The stage's width: the one observer the fit, the mode and the dodge share. */
export function useStageWidth(stage: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);
  return width;
}

const REFIT_MS = 320;

// True for one transition after the mode changes. The reserve appearing or
// disappearing moves the fit by the inspector's whole column, so the page eases
// into its new size instead of popping; plain resizing still tracks the pointer.
export function useRefitEase(mode: InspectorMode, stageWidth: number) {
  const [easing, setEasing] = useState(false);
  const last = useRef<InspectorMode | null>(null);
  useEffect(() => {
    if (!stageWidth) return;
    const previous = last.current;
    last.current = mode;
    if (previous === null || previous === mode) return;
    setEasing(true);
    const timer = setTimeout(() => setEasing(false), REFIT_MS);
    return () => clearTimeout(timer);
  }, [mode, stageWidth]);
  return easing;
}
