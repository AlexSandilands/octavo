"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { SURFACES, type SurfaceKind } from "./surfaces";

// The strip's + menu (#353): what can be opened, in the house MenuSelect
// styling. It is a menu of actions rather than a choice of one value, so it
// is its own small control with the same keyboard contract: opens on click or
// ArrowDown, arrow keys and Home/End move, Enter/Space chooses, Escape and an
// outside press close (Escape returning the focus to +), Tab moves on. A
// surface that can't open here is greyed with its reason under it, still
// focusable so the reason is heard.
export function SurfaceMenu({
  unavailable,
  onOpen,
}: {
  unavailable?: Partial<Record<SurfaceKind, string>>;
  onOpen: (kind: SurfaceKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);
  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };
  const onItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    const n = SURFACES.length;
    const go = (i: number) => {
      e.preventDefault();
      items.current[i]?.focus();
    };
    if (e.key === "ArrowDown") go((index + 1) % n);
    else if (e.key === "ArrowUp") go((index - 1 + n) % n);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
    else if (e.key === "Escape") {
      // The menu owns Escape: the canvas deselects on a window-level one.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") close(false);
  };

  return (
    <div ref={root} className="relative flex-none">
      <button
        ref={button}
        type="button"
        aria-label="Open a surface"
        title="Open a surface"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] border bg-white transition-[transform,background-color,border-color] duration-150 ease-out select-none motion-safe:active:scale-95"
      >
        <Icon name="plus" size={16} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Open a surface"
          className="border-hair absolute top-full right-0 z-30 mt-1.5 min-w-[220px] rounded-lg border bg-white p-1 shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
        >
          {SURFACES.map((surface, i) => {
            const reason = unavailable?.[surface.kind];
            return (
              <button
                key={surface.kind}
                ref={(el) => {
                  items.current[i] = el;
                }}
                type="button"
                role="menuitem"
                aria-disabled={reason ? true : undefined}
                onClick={() => {
                  if (reason) return;
                  onOpen(surface.kind);
                  close(false);
                }}
                onKeyDown={(e) => onItemKeyDown(e, i)}
                className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2.5 text-left font-sans text-sm transition-[background-color,color] duration-150 ${
                  reason
                    ? "text-ink cursor-default opacity-50"
                    : "text-ink hover:bg-accent-wash cursor-pointer"
                }`}
              >
                <Icon
                  name={surface.icon}
                  size={16}
                  className="text-accent mt-0.5 shrink-0"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{surface.label}</span>
                  {reason && (
                    <span className="text-faint text-xs leading-snug">
                      {reason}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
