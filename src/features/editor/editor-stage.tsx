"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { LogoListItem } from "@/lib/logos";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import type { CoverSource } from "@/lib/cover-elements";
import { coverItems } from "@/lib/cover-order";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { CoverOverlayControls } from "./cover-overlay-controls";
import { coverSortingStrategy } from "./cover-sorting";
import { EditorPageContent } from "./editor-page-content";
import { useCoverLayoutWarnings } from "./use-cover-layout-warnings";
import {
  inspectorMode,
  useRefitEase,
  useStageWidth,
} from "./use-inspector-mode";
import {
  INSPECTOR_RESERVE,
  stageDodge,
  type usePanelDock,
} from "./use-panel-dock";
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

type PageEdits = ReturnType<typeof useEditorPages>;
/** What a cover page brings to the stage: its inspector and its item edits. */
export type CoverStageProps = {
  pages: Page[];
  sources: CoverSource[];
  logos: LogoListItem[];
  hasMasthead?: boolean;
  /** Items a pointed-at layout warning is lighting up. */
  hint: string[];
  onHint: (ids: string[]) => void;
  docking: ReturnType<typeof usePanelDock>;
  updateOverlay: PageEdits["updateCoverOverlay"];
  updateElement: PageEdits["updateCoverElement"];
  removeElement: PageEdits["removeCoverElement"];
  moveElement: PageEdits["moveCoverElement"];
};

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
  cover,
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
  /** Present while the page is a cover (or still holds cover items). */
  cover?: CoverStageProps;
}) {
  const padding = barStanding
    ? { top: 40, right: 40, bottom: 40, left: barReserve }
    : { top: 40, right: 40, bottom: barReserve, left: 40 };
  const padX = padding.left + padding.right;

  // How the cover inspector shows: holding a column of the stage, or collapsed
  // to a tab that opens it over the page when the stage is too tight for both.
  const stageRef = useRef<HTMLDivElement>(null);
  const stageWidth = useStageWidth(stageRef);
  const mode = inspectorMode(stageWidth, padX);
  const reserved = Boolean(cover) && mode === "reserved";
  const [overlayOpen, setOverlayOpen] = useState(false);

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
    panRef,
    scale,
    panning,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeClickSuppression,
  } = useCanvasPanZoom({
    containerRef: stageRef,
    contentWidth: PAGE_W,
    contentHeight: PAGE_H,
    // The stage's own padding, the tool bar's reserve included on its side,
    // and the cover inspector's column while it holds one.
    fitMargin: {
      x: padX + (reserved ? INSPECTOR_RESERVE : 0),
      y: padding.top + padding.bottom,
    },
    // Small enough that the page still clears a standing tool bar at the
    // narrowest canvas; the author zooms in from there.
    fitClamp: { min: 0.2, max: 1.4 },
    initialFitScale: 0.75,
    blockSelector: "[data-editor-block]",
  });

  // The page slides away from a reserved inspector only as far as the two
  // would otherwise meet, and never from an overlay.
  const dodge = stageDodge(stageWidth, padX, scale, reserved);
  const refitting = useRefitEase(mode, stageWidth);

  // A new selection opens the overlay inspector; the initial one does not.
  // State adjusted during render (React's own pattern) rather than in an effect.
  const [lastSel, setLastSel] = useState(sel);
  if (sel !== lastSel) {
    setLastSel(sel);
    if (sel) setOverlayOpen(true);
  }
  const warnings = useCoverLayoutWarnings(
    page,
    canvasRef,
    cover?.sources ?? [],
  );

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
    setOverlayOpen(false);
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
      data-editor-stage
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
      <div
        style={{
          transform: `translateX(${cover?.docking.dock === "left" ? dodge : -dodge}px)`,
        }}
        className={
          cover?.docking.moved || refitting
            ? "transition-transform duration-300 ease-out motion-reduce:transition-none"
            : undefined
        }
      >
        <PageDropZone
          panRef={panRef as RefObject<HTMLDivElement | null>}
          className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]"
        >
          <ScaledPage scale={scale} eased={refitting}>
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
              coverDecoration={page?.coverOverlay?.decoration}
              coverMasthead={page?.coverOverlay?.masthead}
              bleed={filled}
            >
              <SortableContext
                items={(page?.cover
                  ? coverItems(page)
                  : (page?.blocks ?? [])
                ).map((b) => b.id)}
                strategy={
                  page?.cover
                    ? coverSortingStrategy(page, scale)
                    : verticalListSortingStrategy
                }
              >
                {page && (
                  <EditorPageContent
                    page={page}
                    containerRef={canvasRef}
                    sources={cover?.sources ?? []}
                    issueNo={issueNo}
                    issueId={issueId}
                    theme={theme}
                    images={images}
                    sponsors={sponsors}
                    sponsorMap={sponsorMap}
                    reseed={reseed}
                    sel={sel}
                    hint={cover?.hint ?? []}
                    overflow={overflow}
                    onSelect={onSelect}
                    onSelectElement={onSelect}
                    updateBlock={actions.updateBlock}
                    updateElement={cover?.updateElement ?? (() => {})}
                    moveBlock={actions.moveBlock}
                    removeBlock={actions.removeBlock}
                    removeElement={cover?.removeElement ?? (() => {})}
                    moveElement={cover?.moveElement ?? (() => {})}
                    flow={flow}
                    fillPage={actions.fillPage}
                    registerImage={actions.registerImage}
                    preview={
                      preview
                        ? { index: preview.index, node: dropPreview }
                        : null
                    }
                  />
                )}
              </SortableContext>
            </PageFrame>
          </ScaledPage>
        </PageDropZone>
      </div>
      {cover && page && (
        <CoverOverlayControls
          docking={cover.docking}
          mode={mode}
          stage={{ width: stageWidth, barStanding, barReserve }}
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          hasMasthead={cover.hasMasthead}
          issueId={issueId}
          onFillPage={actions.fillPage}
          warnings={warnings}
          page={page}
          pages={cover.pages}
          sources={cover.sources}
          selectedId={sel}
          onSelect={onSelect}
          logos={cover.logos}
          onRegisterImage={actions.registerImage}
          onChange={cover.updateOverlay}
          onUpdate={cover.updateElement}
          onUpdateBlock={actions.updateBlock}
          onHint={cover.onHint}
        />
      )}
    </div>
  );
}
