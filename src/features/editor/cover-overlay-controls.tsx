"use client";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Page } from "@/lib/blocks";
import { COVER_ELEMENT_LABELS } from "@/lib/cover-elements";
import { coverOverlayOf } from "@/lib/cover-order";
import { CoverInspector, type CoverInspectorProps } from "./cover-inspector";
import { InspectorTab, TAB_W } from "./inspector-tab";
import type { InspectorMode } from "./use-inspector-mode";
import { INSPECTOR_RESERVE, type usePanelDock } from "./use-panel-dock";

const PANEL_ID = "cover-inspector";

type Props = Omit<CoverInspectorProps, "page" | "overlay" | "pageNumber"> & {
  page?: Page;
  pages: Page[];
  docking: ReturnType<typeof usePanelDock>;
  mode: InspectorMode;
  /** The stage it floats in: its width, and the room its tool bar owns. */
  stage: { width: number; barStanding: boolean; barReserve: number };
  /** Whether an overlay inspector is out. The stage owns it, so a deselect
   *  (Escape, a press on blank canvas) closes the overlay too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
/** Floats over the stage on the docked side. A stage with room pads that side
 *  so the fitted page stays clear; a tight one collapses it to a tab. Either
 *  way a panned page shows through underneath. */
export function CoverOverlayControls({
  page,
  pages,
  docking,
  mode,
  stage,
  open: overlayOpen,
  onOpenChange,
  ...props
}: Props) {
  const { dock, setDock, drag, onHandlePointerDown, onHandleClick } = docking;
  if (!page) return null;
  const element = page.coverElements?.find((e) => e.id === props.selectedId);
  const block = page.blocks.find(
    (b) =>
      b.id === props.selectedId &&
      (b.type === "heading" ||
        b.type === "text" ||
        (page.cover && b.type === "image")),
  );
  const selected = Boolean(element || block);
  const title = element
    ? COVER_ELEMENT_LABELS[element.type]
    : block?.type === "heading"
      ? "Heading"
      : block?.type === "image"
        ? "Image"
        : block
          ? "Text"
          : "Cover";
  const other: typeof dock = dock === "left" ? "right" : "left";
  const overlay = mode === "overlay";
  const open = !overlay || overlayOpen;
  const close = () => {
    onOpenChange(false);
    props.onSelect(null);
  };
  // The standing tool bar owns the left edge and the lying one the foot; the
  // tab stands inside the first, the panel inside both.
  const barPad = stage.barStanding && dock === "left" ? stage.barReserve : 0;
  const inset = barPad + (overlay ? TAB_W : 0);
  return (
    <>
      {overlay && (
        <InspectorTab
          panelId={PANEL_ID}
          dock={dock}
          open={open}
          title={title}
          offset={barPad}
          onToggle={() => (open ? close() : onOpenChange(true))}
        />
      )}
      <div
        style={{
          width: INSPECTOR_RESERVE + inset,
          maxWidth: stage.width ? stage.width - 24 : undefined,
          paddingBottom: stage.barStanding ? 20 : stage.barReserve,
          ...(dock === "left"
            ? { paddingLeft: inset + 24 }
            : { paddingRight: inset + 24 }),
        }}
        // Inside the stage: a press here is the panel's, not a pan or a deselect,
        // and the wheel scrolls the panel rather than zooming the page.
        data-canvas-chrome
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        // An overlay sits above the tool bar: on a stage this tight the two
        // cannot both have the room, and the bar is one press of Done away.
        className={`pointer-events-none absolute inset-y-0 items-start pt-5 ${
          overlay ? "z-40" : "z-10"
        } ${open ? "flex" : "hidden"} ${
          dock === "left" ? "left-0 pr-3" : "right-0 pl-3"
        }`}
      >
        <aside
          id={PANEL_ID}
          aria-label="Cover element settings"
          style={
            drag
              ? { transform: `translate(${drag.x}px, ${drag.y}px)` }
              : undefined
          }
          className={`border-hair-warm bg-card pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-[14px] border shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--color-ink)_14%,transparent)] ${
            drag
              ? "opacity-90 shadow-[0_18px_40px_-8px_color-mix(in_srgb,var(--color-ink)_30%,transparent)]"
              : "transition-transform"
          }`}
        >
          <div className="border-line flex h-14 shrink-0 items-center gap-2 border-b pr-3 pl-1.5">
            <button
              type="button"
              aria-label={`Move panel to the ${other}`}
              title="Drag to the other side of the page"
              onPointerDown={onHandlePointerDown}
              onClick={onHandleClick}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setDock("left");
                if (e.key === "ArrowRight") setDock("right");
              }}
              className="text-faint2 hover:bg-accent-wash hover:text-accent flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md transition-colors active:cursor-grabbing"
            >
              <Icon name="grip" size={16} />
            </button>
            <h2 className="min-w-0 flex-1 truncate font-serif text-lg">
              {title}
            </h2>
            {(selected || overlay) && (
              <Button variant="secondary" size="sm" onClick={close}>
                Done
              </Button>
            )}
          </div>
          <CoverInspector
            key={props.selectedId ?? "cover"}
            {...props}
            page={page}
            overlay={coverOverlayOf(page)}
            pageNumber={pages.findIndex((p) => p.id === page.id) + 1}
          />
        </aside>
      </div>
    </>
  );
}
