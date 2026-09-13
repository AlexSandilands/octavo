"use client";

import { Icon } from "@/components/icons";
import type { Dock } from "./use-panel-dock";

/** Width of the collapsed inspector's tab; the open panel sits beside it. */
export const TAB_W = 44;

// The collapsed inspector: a tab on its docked edge, labelled with what the
// inspector shows, that opens the panel over the page and closes it again.
export function InspectorTab({
  panelId,
  dock,
  open,
  title,
  offset,
  onToggle,
}: {
  panelId: string;
  dock: Dock;
  open: boolean;
  title: string;
  /** Room a standing tool bar owns on this edge. */
  offset: number;
  onToggle: () => void;
}) {
  const outward = dock === "left" ? "chevronLeft" : "chevronRight";
  const inward = dock === "left" ? "chevronRight" : "chevronLeft";
  return (
    <button
      type="button"
      data-inspector-tab
      // Inside the stage: a press here is the tab's, not a pan or a deselect.
      data-canvas-chrome
      aria-expanded={open}
      aria-controls={panelId}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={
        dock === "left"
          ? { width: TAB_W, left: offset }
          : { width: TAB_W, right: offset }
      }
      className={`border-hair-warm bg-card text-body hover:bg-accent-wash hover:text-accent absolute top-1/2 z-40 flex h-32 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 border py-3 shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--color-ink)_14%,transparent)] transition-colors ${
        dock === "left"
          ? "rounded-r-[12px] border-l-0"
          : "rounded-l-[12px] border-r-0"
      }`}
    >
      <Icon name={open ? outward : inward} size={14} />
      <span className="rotate-180 font-serif text-sm [writing-mode:vertical-rl]">
        {title}
      </span>
    </button>
  );
}
