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

// Joins the canvas measurement to the edit that fixes it (issue #93): where the
// page being edited overflows, and the one action that resolves it. Every block
// type is covered — body text is split at a node boundary, anything else moves
// whole — and the caller doesn't need to know which it will be.
//
// Measurement runs after every render — typing, pasting and every structural
// edit all re-render the canvas — plus on a ResizeObserver for the changes React
// doesn't drive, such as a web font finishing or an image decoding.
export function useTextFlow({
  page,
  onFlow,
  onMove,
}: {
  page: Page | undefined;
  onFlow: (blockId: string, cuts: number[]) => void;
  onMove: (blockId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  // The one block this page overflows at, and where the page ends within it.
  const [overflow, setOverflow] = useState<BlockOverflow | null>(null);

  // Cover pages centre their blocks instead of flowing them from the top, and
  // have nothing to continue onto — leave them out of this entirely.
  const measurable = Boolean(page && !page.cover);

  const measure = useCallback(() => {
    const el = canvasRef.current;
    const next = el && measurable ? measurePageOverflow(el) : null;
    // Keeping the previous value when nothing changed is what lets the
    // every-render measure below settle instead of looping.
    setOverflow((now) =>
      next?.id !== now?.id ||
      next?.markerTop !== now?.markerTop ||
      next?.fitsAlone !== now?.fitsAlone
        ? next
        : now,
    );
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

  // Split body text that has a node boundary to cut at; move anything else —
  // an image, a heading, a sponsor panel, a lone paragraph — whole.
  const flow = (blockId: string) => {
    const el = canvasRef.current;
    const block = page?.blocks.find((b) => b.id === blockId);
    if (!el || !block) return;
    if (block.type === "text") {
      const nodes = richDocBlocks(block.text).length;
      const metrics = nodes > 1 ? measureTextFlow(el, blockId, nodes) : null;
      const cuts = metrics ? planTextFlow(metrics) : [];
      if (cuts.length > 0) {
        onFlow(blockId, cuts);
        return;
      }
    }
    onMove(blockId);
  };

  return { canvasRef, overflow, flow };
}
