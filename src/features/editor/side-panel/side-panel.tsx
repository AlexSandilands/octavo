"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui";

const SLIDE_MS = 320;
const STEP = 24;

// The editor's right-hand panel. Hidden until a tool on the rail asks for it,
// then it slides in from the right edge and the canvas re-fits beside it. The
// content sits at its full width anchored to the right, so it slides rather than
// unfolds. The left edge is a drag handle (and a keyboard separator) that
// resizes it. The content stays mounted through the closing slide and unmounts
// after, so an open PDF releases its worker when the panel is dismissed.
export function SidePanel({
  id,
  open,
  title,
  width,
  min,
  max,
  onResize,
  onClose,
  children,
}: {
  id: string;
  open: boolean;
  title: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onClose: () => void;
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
      className={`border-line bg-card relative flex-none overflow-hidden border-l ${
        dragging
          ? ""
          : "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
      }`}
    >
      <div
        style={{ width }}
        className="absolute inset-y-0 right-0 flex flex-col"
      >
        <header className="border-line flex h-[52px] flex-none items-center justify-between border-b pr-4 pl-5">
          <h2 className="text-ink font-serif text-[19px]">{title}</h2>
          <IconButton icon="close" label="Close panel" onClick={onClose} />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {mounted && children}
        </div>
      </div>
      {/* The handle straddles the panel's left border: a wide hit area around a
          hairline that lights up on hover and while dragging. */}
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
        className={`group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none select-none ${
          dragging ? "" : "focus-visible:outline-offset-[-2px]"
        }`}
      >
        <span
          className={`absolute inset-y-0 left-[5px] w-0.5 transition-colors duration-150 ${
            dragging
              ? "bg-accent"
              : "bg-transparent group-hover:bg-accent group-focus-visible:bg-accent"
          }`}
        />
      </div>
    </aside>
  );
}
