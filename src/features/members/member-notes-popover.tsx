"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

export function MemberNotesPopover({
  id,
  notes,
  label,
  trigger,
  pinned,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  id: string;
  notes: string;
  label: string;
  trigger: RefObject<HTMLButtonElement | null>;
  pinned: boolean;
  onClose: (restoreFocus?: boolean) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = trigger.current;
    if (!anchor || !panel.current) return;
    const r = anchor.getBoundingClientRect();
    const gap = 6;
    const edge = 12;
    const below = window.innerHeight - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    const up = below < Math.min(240, above);
    const width = Math.min(360, window.innerWidth - edge * 2);
    Object.assign(panel.current.style, {
      visibility: "visible",
      width: `${width}px`,
      left: `${Math.max(edge, Math.min(r.left, window.innerWidth - width - edge))}px`,
      ...(up
        ? { bottom: `${window.innerHeight - r.top + gap}px` }
        : { top: `${r.bottom + gap}px` }),
      maxHeight: `${Math.max(0, Math.min(320, up ? above : below))}px`,
    });
  }, [trigger]);

  useEffect(() => {
    if (pinned) panel.current?.focus({ preventScroll: true });
  }, [pinned]);

  useEffect(() => {
    const hasFocus = () =>
      panel.current?.contains(document.activeElement) ?? false;
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        onClose(hasFocus());
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose(hasFocus());
    };
    const moved = (event: Event) => {
      if (
        event.type === "resize" ||
        !panel.current?.contains(event.target as Node)
      )
        onClose(hasFocus());
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [onClose, trigger]);

  return createPortal(
    <div
      ref={panel}
      id={id}
      data-member-notes-popup
      role="region"
      aria-label={`Full notes for ${label}`}
      tabIndex={0}
      style={{ visibility: "hidden" }}
      className="scrollbar-soft bg-card text-body border-hair fixed z-[100] overflow-y-auto rounded-lg border p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap shadow-lg [--scrollbar-surface:var(--color-card)] [overflow-wrap:anywhere] [scrollbar-gutter:stable]"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          event.relatedTarget !== trigger.current
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          // Resume the row's natural tab order, rather than the portal's DOM position.
          if (event.shiftKey) event.preventDefault();
          trigger.current?.focus({ preventScroll: true });
          onClose();
        }
      }}
    >
      {notes}
    </div>,
    document.body,
  );
}
