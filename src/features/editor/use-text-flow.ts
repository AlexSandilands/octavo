"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/blocks";
import { richDocBlocks } from "@/lib/rich-text-split";
import {
  measurePageOverflow,
  measureTextFlow,
  type BlockOverflow,
} from "./page-metrics";
import { planTextFlow } from "./text-flow";

// Joins the canvas measurement to the flow edit (issue #93): which blocks on the
// page being edited run past it, and the action that fixes an overflowing text
// block.
//
// Measurement runs after every render — typing, pasting and every structural
// edit all re-render the canvas — plus on a ResizeObserver for the changes React
// doesn't drive, such as a web font finishing or an image decoding.
export function useTextFlow({
  page,
  onFlow,
}: {
  page: Page | undefined;
  onFlow: (blockId: string, cuts: number[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  // The one block this page overflows at, and where the page ends within it.
  const [overflow, setOverflow] = useState<BlockOverflow | null>(null);
  const overflowRef = useRef(overflow);
  overflowRef.current = overflow;

  // Cover pages centre their blocks instead of flowing them from the top, and
  // have nothing to continue onto — leave them out of this entirely.
  const measurable = Boolean(page && !page.cover);

  const measure = useCallback(() => {
    const el = canvasRef.current;
    const next = el && measurable ? measurePageOverflow(el) : null;
    const now = overflowRef.current;
    if (next?.id !== now?.id || next?.markerTop !== now?.markerTop) {
      setOverflow(next);
    }
  }, [measurable]);

  // Re-measure after every render, then once more only if that changed
  // something — the second pass finds nothing new, so this settles immediately.
  useEffect(measure);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const flow = (blockId: string) => {
    const el = canvasRef.current;
    const block = page?.blocks.find((b) => b.id === blockId);
    if (!el || !block || block.type !== "text") return;
    const nodes = richDocBlocks(block.text).length;
    const metrics = measureTextFlow(el, blockId, nodes);
    if (!metrics) return;
    const cuts = planTextFlow(metrics);
    if (cuts.length > 0) onFlow(blockId, cuts);
  };

  return { canvasRef, overflow, flow };
}
