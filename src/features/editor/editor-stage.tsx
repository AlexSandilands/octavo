"use client";

import { Fragment, useEffect, useEffectEvent, type RefObject } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { EditorBlock } from "./editor-block";
import { DropPreview } from "./pdf-import/drop-preview";
import { StageBadge } from "./stage-badge";
import type { useEditorPages } from "./use-editor-pages";
import { usePdfDragOut, PageDropZone } from "./use-pdf-drag-out";
import { useTextFlow } from "./use-text-flow";

/** The block edits the stage hands on; the page model owns them. */
export type StageActions = Pick<
  ReturnType<typeof useEditorPages>,
  | "updateBlock"
  | "moveBlock"
  | "removeBlock"
  | "fillPage"
  | "flowText"
  | "moveToNextPage"
> & { registerImage: (imageId: string, image: ResolvedImage) => void };

// The magazine canvas: the fixed PAGE_W×PAGE_H page fitted to the stage
// exactly as the reader fits it — a faithful, to-scale preview — with a
// wheel/drag zoom+pan riding on top. No scrollbars: content past the page edge
// is reached by dragging, and the overflow marker shows where the page ran
// out. Drag starts only on blank areas so blocks stay selectable, editable and
// sortable (dnd-kit owns their pointer events). A region dragged out of the
// PDF panel previews here as the block it will become.
export function EditorStage({
  issueId,
  issueNo,
  page,
  curPage,
  sel,
  theme,
  logo,
  settings,
  filled,
  barStanding,
  barReserve,
  images,
  sponsors,
  sponsorMap,
  reseed,
  preview,
  onSelect,
  actions,
}: {
  issueId: string;
  issueNo: number;
  page: Page | undefined;
  curPage: number;
  sel: string | null;
  theme: LayoutTheme;
  logo: ResolvedImage | null;
  settings: SiteSettings;
  /** This page is owned by a full-bleed photo (issue #227). */
  filled: boolean;
  /** The tool bar stands at the left edge, so the room for it moves there. */
  barStanding: boolean;
  /** Space occupied by the bar on its current edge, including page clearance. */
  barReserve: number;
  images: ImageMap;
  sponsors: SponsorListItem[];
  sponsorMap: SponsorMap;
  /** Per-block remount counters: a rewrite behind an editor's back lands by remounting. */
  reseed: Record<string, number>;
  preview: ReturnType<typeof usePdfDragOut>["preview"];
  onSelect: (id: string | null) => void;
  actions: StageActions;
}) {
  const padding = barStanding
    ? { top: 40, right: 40, bottom: 40, left: barReserve }
    : { top: 40, right: 40, bottom: barReserve, left: 40 };

  // Overflow marking + its one-action fix (issue #93): the canvas is measured
  // where it is laid out, and the split — or, for a block that can't be cut,
  // the move — lands as one edit.
  const { canvasRef, overflow, flow } = useTextFlow({
    page,
    onFlow: actions.flowText,
    onMove: actions.moveToNextPage,
  });

  // Destructured: property access on the returned object would read through
  // the ref it carries, which the render can't do.
  const {
    containerRef: stageRef,
    panRef,
    scale,
    panning,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeClickSuppression,
  } = useCanvasPanZoom({
    contentWidth: PAGE_W,
    contentHeight: PAGE_H,
    // The stage's own padding, the tool bar's reserve included on its side.
    fitMargin: {
      x: padding.left + padding.right,
      y: padding.top + padding.bottom,
    },
    // Small enough that the page still clears a standing tool bar at the
    // narrowest canvas; the author zooms in from there.
    fitClamp: { min: 0.2, max: 1.4 },
    initialFitScale: 0.75,
    blockSelector: "[data-editor-block]",
  });

  // Reset zoom/pan to the fitted view when switching pages.
  useEffect(() => {
    resetView();
    // resetView is recreated each render; page change is the trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPage]);

  // Deselect the current block and collapse any lingering text highlight.
  // Clicking blank canvas (or pressing Escape) should clear a text selection
  // like a normal document, but the canvas pan/zoom layer captures the pointer
  // on an outside press, which suppresses the browser's native
  // click-to-collapse — so blur the active editable and clear the selection
  // ourselves. Covers every in-place editor (Tiptap body text and the plain
  // contentEditable headings / cover text alike).
  const deselect = () => {
    onSelect(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.isContentEditable) {
      active.blur();
    }
    window.getSelection()?.removeAllRanges();
  };
  // An effect event so the once-bound listener calls the latest closure.
  const deselectByKey = useEffectEvent(() => deselect());
  // Escape deselects the current block (click-off on the canvas does too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") deselectByKey();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dropPreview = preview && (
    <DropPreview
      block={preview.block}
      theme={theme}
      images={preview.images}
      sponsors={sponsorMap}
    />
  );

  return (
    <div
      ref={stageRef}
      onClick={() => {
        // A drag-pan ends in a click; don't let it deselect the block.
        if (consumeClickSuppression()) return;
        deselect();
      }}
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
      className={`relative flex flex-1 items-center justify-center overflow-hidden ${
        panning ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
    >
      <StageBadge>Magazine</StageBadge>
      <PageDropZone
        panRef={panRef as RefObject<HTMLDivElement | null>}
        className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]"
      >
        <ScaledPage scale={scale}>
          <PageFrame
            theme={theme}
            w={PAGE_W}
            h={PAGE_H}
            issueNo={issueNo}
            pageNo={curPage + 1}
            logo={logo}
            settings={settings}
            clip={false}
            cover={page?.cover}
            bleed={filled}
          >
            <SortableContext
              items={(page?.blocks ?? []).map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                ref={canvasRef}
                className={
                  page?.cover
                    ? "flex min-h-full flex-col justify-center"
                    : "relative flow-root"
                }
              >
                {page && page.blocks.length === 0 && !preview && (
                  <div className="text-faint2 py-16 text-center font-serif text-sm">
                    This page is empty. Add a block below.
                  </div>
                )}
                {page?.blocks.map((b, i) => (
                  // Remounting is how a rewrite behind an uncontrolled
                  // editor's back (a split, an undo) lands.
                  <Fragment key={`${b.id}:${reseed[b.id] ?? 0}`}>
                    {preview?.index === i && dropPreview}
                    <EditorBlock
                      block={b}
                      theme={theme}
                      cover={page.cover}
                      selected={b.id === sel}
                      issueId={issueId}
                      images={images}
                      sponsors={sponsors}
                      sponsorMap={sponsorMap}
                      overflowAt={
                        overflow?.id === b.id ? overflow.markerTop : undefined
                      }
                      fitsAlone={overflow?.fitsAlone}
                      onSelect={() => onSelect(b.id)}
                      onChange={(patch) => actions.updateBlock(b.id, patch)}
                      onMove={(dir) => actions.moveBlock(b.id, dir)}
                      onRemove={() => actions.removeBlock(b.id)}
                      onFlow={() => flow(b.id)}
                      onFillPage={(a) => actions.fillPage(b.id, a)}
                      onRegisterImage={actions.registerImage}
                    />
                  </Fragment>
                ))}
                {preview &&
                  preview.index >= (page?.blocks.length ?? 0) &&
                  dropPreview}
              </div>
            </SortableContext>
          </PageFrame>
        </ScaledPage>
      </PageDropZone>
    </div>
  );
}
