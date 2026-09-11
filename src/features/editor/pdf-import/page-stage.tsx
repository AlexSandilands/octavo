"use client";

import { useEffect, type ReactNode } from "react";
import { PAGE_W } from "@/features/blocks/page-frame";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { TOOLBAR_RESERVE } from "../floating-bar";
import type { SourcePage } from "./model";

// The PDF page on a canvas of its own, fitted and moved exactly like the
// magazine page beside it: laid out at the magazine's page width, scaled to fit
// the panel, then wheel-zoomed and dragged on top. A drag may start on a region
// (they cover most of a text page) and becomes a pan once it clearly moves;
// a plain press still selects. The same stage padding and tool-bar reserve as
// the editor give the two pages the same fit when they share the row.
export function PageStage({
  page,
  barStanding,
  children,
}: {
  page: SourcePage;
  /** The tool bar stands at the right edge, so the room for it moves there. */
  barStanding: boolean;
  children: ReactNode;
}) {
  const height = Math.round((PAGE_W * page.height) / page.width);
  const padding = barStanding
    ? { top: 40, right: TOOLBAR_RESERVE, bottom: 40, left: 40 }
    : { top: 40, right: 40, bottom: TOOLBAR_RESERVE, left: 40 };
  const {
    containerRef,
    panRef,
    scale,
    panning,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useCanvasPanZoom({
    contentWidth: PAGE_W,
    contentHeight: height,
    fitMargin: {
      x: padding.left + padding.right,
      y: padding.top + padding.bottom,
    },
    fitClamp: { min: 0.2, max: 1.4 },
    initialFitScale: 0.75,
    blockSelector: "[data-region-overlay]",
    panOverBlocks: true,
  });

  // A new page (or a new file) starts from the fitted view, as the editor does
  // when the author switches pages.
  useEffect(() => {
    resetView();
    // resetView is recreated each render; the page is the trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        paddingTop: padding.top,
        paddingRight: padding.right,
        paddingBottom: padding.bottom,
        paddingLeft: padding.left,
      }}
      className={`flex flex-1 items-center justify-center overflow-hidden ${
        panning ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
    >
      <div ref={panRef} className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]">
        <div
          style={{ width: PAGE_W * scale, height: height * scale }}
          className="flex-none"
        >
          <div
            style={
              {
                width: PAGE_W,
                height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                // Lets the region chips cancel the scale (see `.chrome-unscaled`).
                "--page-scale": scale,
              } as React.CSSProperties
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
