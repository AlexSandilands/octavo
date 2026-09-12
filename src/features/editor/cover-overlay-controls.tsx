"use client";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Page } from "@/lib/blocks";
import { COVER_ELEMENT_LABELS } from "@/lib/cover-elements";
import { coverOverlayOf } from "@/lib/cover-order";
import { CoverInspector, type CoverInspectorProps } from "./cover-inspector";
import type { usePanelDock } from "./use-panel-dock";

/** Width of the inspector's column (panel plus its gutters), which the stage pads out. */
export const INSPECTOR_RESERVE = 344;

type Props = Omit<CoverInspectorProps, "page" | "overlay" | "pageNumber"> & {
  page?: Page;
  pages: Page[];
  docking: ReturnType<typeof usePanelDock>;
};
/** Floats over the stage on the docked side; the stage pads that side so the
 *  fitted page stays clear, while a panned page shows through underneath. */
export function CoverOverlayControls({
  page,
  pages,
  docking,
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
  return (
    <div
      style={{ width: INSPECTOR_RESERVE }}
      className={`pointer-events-none absolute inset-y-0 z-10 flex items-start pt-5 pb-[92px] ${
        dock === "left" ? "left-0 pr-3 pl-6" : "right-0 pr-6 pl-3"
      }`}
    >
      <aside
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
          {selected && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => props.onSelect(null)}
            >
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
  );
}
