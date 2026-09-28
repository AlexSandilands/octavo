"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SLIDE_MS = 320;
const STEP = 24;
/** The resize handle straddles the panel's left edge, invisible until focused. */
const HANDLE = 10;

// The editor's right-hand panel. Hidden until a tool on the rail asks for it,
// then it slides in from the right edge and the canvas re-fits beside it. The
// content sits at its full width anchored to the right, so it slides rather than
// unfolds. Its left edge is a hairline; the drag handle (and keyboard
// separator) that resizes the panel straddles it, unseen until it is focused
// or dragged, so the seam between the two stages stays quiet (#353). There is
// no header: the Panel button that opened it is pressed while it is out and
// closes it again, and the strip of tabs owns the top. The content stays
// mounted through the closing slide and unmounts after, so an open PDF
// releases its worker when the panel is dismissed.
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
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLElement>(null);
  // Mount in the same render the panel opens (adjusting state during render —
  // the single guarded setter is stable and doesn't depend on this component
  // re-rendering for any other reason), then unmount a slide after it closes so
  // an open PDF releases its worker only once the panel is gone.
  if (open && !mounted) setMounted(true);
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
      {/* The clip lives here, not on the aside, so the handle can overhang the
          edge while the sliding content is still cut at it. The hairline is
          drawn inside, so the panel's width is exactly what it is set to. */}
      <div className="absolute inset-0 overflow-hidden">
        <div aria-hidden className="bg-line absolute inset-y-0 left-0 w-px" />
        <div
          style={{ width }}
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
        style={{ width: HANDLE, left: -HANDLE / 2 }}
        className={`absolute inset-y-0 z-10 cursor-col-resize touch-none rounded-sm transition-colors duration-150 select-none ${
          mounted ? "block" : "hidden"
        } ${dragging ? "bg-accent/30" : "hover:bg-accent/15"}`}
      />
    </aside>
  );
}
