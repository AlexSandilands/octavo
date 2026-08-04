"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { usePrePaintEffect } from "./use-pre-paint-effect";

// The two-column split on /admin/magazine: settings on the left, the live page
// preview on the right, with a draggable rail between them. The owner is
// looking at two things at once and which one wants the room changes with the
// job — reading the preview's footer at a small mark, or typing a long club
// name — so the balance is theirs to set, and it is remembered.
//
// Only above `xl`. Below it the two panes stack (the preview under the form),
// which is the layout that already worked; the rail is not rendered there at
// all, so it never takes a tab stop on a narrow screen.

const MIN_PERCENT = 25;
const MAX_PERCENT = 75;
const DEFAULT_PERCENT = 50;
/** One arrow key press. Coarse enough to cross the range in a few taps. */
const STEP_PERCENT = 5;

function clamp(percent: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent));
}

// The stored split is a number a user could hand-edit; treat it as input.
function readStored(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? clamp(value) : null;
  } catch {
    return null; // storage disabled (private mode, blocked cookies) — no harm
  }
}

export function ResizableSplit({
  storageKey,
  label,
  left,
  right,
}: {
  /** localStorage key the chosen split is remembered under. */
  storageKey: string;
  /** Accessible name for the rail, e.g. "Settings and preview split". */
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  // Always the default on the server and on the first client render — reading
  // storage during render would make the two disagree and break hydration. The
  // stored value is applied in an effect instead, before the first paint so the
  // layout is not seen to jump from 50% to whatever was remembered.
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Where the drag started and what the split was then, so the rail moves with
  // the pointer instead of jumping to it. `moved` keeps a plain click — press
  // and release with no travel — from committing anything at all.
  const dragRef = useRef<{ x: number; percent: number; moved: boolean } | null>(
    null,
  );
  const leftPaneId = useId();

  usePrePaintEffect(() => {
    const stored = readStored(storageKey);
    if (stored !== null) setPercent(stored);
  }, [storageKey]);

  const commit = useCallback(
    (next: number) => {
      const value = clamp(next);
      setPercent(value);
      try {
        window.localStorage.setItem(storageKey, String(Math.round(value)));
      } catch {
        // Storage unavailable: the split still works, it just won't be
        // remembered. Not worth telling anyone about.
      }
    },
    [storageKey],
  );

  // The split the drag has reached: where it started, plus how far the pointer
  // has travelled since. Deliberately NOT the pointer's absolute position —
  // that would snap the rail to the pointer on mousedown, hopping the layout by
  // however far into the hit area the grab landed.
  const percentFromDrag = (clientX: number): number => {
    const start = dragRef.current;
    const el = containerRef.current;
    if (!start || !el) return percent;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return percent;
    return clamp(start.percent + ((clientX - start.x) / rect.width) * 100);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Pointer capture keeps the drag alive when the pointer outruns the rail —
    // which it will, since the rail is a few pixels wide. Nothing moves yet.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, percent, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) >= 1) start.moved = true;
    if (start.moved) setPercent(percentFromDrag(e.clientX));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    // A click that never travelled leaves both the split and what's stored
    // exactly as they were.
    if (start.moved) commit(percentFromDrag(e.clientX));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const move =
      e.key === "ArrowLeft"
        ? -STEP_PERCENT
        : e.key === "ArrowRight"
          ? STEP_PERCENT
          : 0;
    if (move !== 0) {
      e.preventDefault();
      commit(percent + move);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      commit(MIN_PERCENT);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(MAX_PERCENT);
    }
  };

  return (
    <div
      ref={containerRef}
      // The rail column is 2rem wide, standing in for the gap the stacked
      // layout keeps between the panes.
      style={{ "--split": `${percent}%` } as React.CSSProperties}
      // Grid items keep their default `stretch`: a sticky child only travels
      // inside its own grid area, so `items-start` (which shrink-wraps the area
      // to the content) would leave the preview nothing to stick within and it
      // would scroll away with the form.
      className={`mt-7 flex flex-col gap-8 xl:grid xl:grid-cols-[var(--split)_2rem_minmax(0,1fr)] xl:gap-0 ${
        // While dragging, the pointer is captured by the rail but travels over
        // the panes: hold the resize cursor and stop the drag from selecting
        // the form's labels on the way past.
        dragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      <div id={leftPaneId} className="flex min-w-0 flex-col gap-6">
        {left}
      </div>

      {/* Hidden below xl, where the panes stack and there is nothing to split. */}
      <div className="hidden xl:flex xl:justify-center">
        <div
          role="separator"
          tabIndex={0}
          aria-label={label}
          aria-orientation="vertical"
          aria-controls={leftPaneId}
          aria-valuemin={MIN_PERCENT}
          aria-valuemax={MAX_PERCENT}
          aria-valuenow={Math.round(percent)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          // touch-none so a touch drag resizes instead of scrolling the page.
          className="group sticky top-0 flex h-[70vh] w-8 cursor-col-resize touch-none items-center justify-center rounded"
        >
          {/* The rail: a hairline the full height of the control, with a short
              grip at the middle so it reads as something to take hold of. */}
          <span
            aria-hidden="true"
            className={`bg-line group-hover:bg-accent absolute inset-y-0 w-px transition-colors ${
              dragging ? "bg-accent" : ""
            }`}
          />
          <span
            aria-hidden="true"
            className={`border-hair-warm group-hover:border-accent group-hover:bg-accent-wash relative h-10 w-[7px] rounded-full border-[1.5px] bg-white transition-colors ${
              dragging ? "border-accent bg-accent-wash" : ""
            }`}
          />
        </div>
      </div>

      {/* The pane is the (stretched) grid area; the sticky box is its child, so
          the preview stays on screen while the form scrolls beside it. */}
      <div className="min-w-0">
        <div className="xl:sticky xl:top-0">{right}</div>
      </div>
    </div>
  );
}
