"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SplitGrip } from "@/components/split-grip";

const SLIDE_MS = 320;
const STEP = 24;
/** The gutter between canvas and panel: a visible strip with a grip, part of `width`. */
const GUTTER = 14;

// The editor's right-hand panel. Hidden until a tool on the rail asks for it,
// then it slides in from the right edge and the canvas re-fits beside it. The
// content sits at its full width anchored to the right, so it slides rather than
// unfolds. Its left edge is a gutter with a grip in the middle — the visible
// seam between the two stages, and the drag handle (and keyboard separator)
// that resizes the panel. There is no header: the rail button that opened the panel is
// pressed while it is out and closes it again, and the tool owns the whole
// height. The content stays mounted through the closing slide and unmounts
// after, so an open PDF releases its worker when the panel is dismissed.
export function SidePanel({
  id,
  open,
  title,
  width,
  min,
  max,
  onResize,
  children,
}: {
  id: string;
  open: boolean;
  title: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLElement>(null);
  // Mount with the open, unmount a slide after the close.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMounted(true);
  }
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !panel.current) return;
    const right = panel.current.getBoundingClientRect().right;
    onResize(Math.round(right - e.clientX));
  };
  const endDrag = () => setDragging(false);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowLeft"
        ? width + STEP
        : e.key === "ArrowRight"
          ? width - STEP
          : e.key === "Home"
            ? min
            : e.key === "End"
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    onResize(next);
  };

  return (
    <aside
      ref={panel}
      id={id}
      aria-label={title}
      aria-hidden={!open || undefined}
      inert={!open}
      style={{ width: open ? width : 0 }}
      className={`bg-card relative flex-none ${
        dragging
          ? ""
          : "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
      }`}
    >
      {/* The clip lives here, not on the aside, so the grip can overhang the
          gutter's edges while the sliding content is still cut at them. */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          style={{ width: width - GUTTER }}
          className="absolute inset-y-0 right-0 flex flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {mounted && children}
          </div>
        </div>
      </div>
      {/* The gutter is the handle: hairlines either side, the shared grip
          overhanging them in the middle, tinted on hover and while dragging. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={width}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={open ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{ width: GUTTER }}
        className={`border-line group absolute inset-y-0 left-0 z-10 cursor-col-resize touch-none items-center justify-center border-x transition-colors duration-150 select-none focus-visible:outline-offset-[-2px] ${
          mounted ? "flex" : "hidden"
        } ${dragging ? "bg-accent-wash" : "bg-paper hover:bg-accent-wash"}`}
      >
        <SplitGrip dragging={dragging} />
      </div>
    </aside>
  );
}
