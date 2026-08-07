"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// The house dropdown: a labelled pill trigger ("Theme: Classic") over a small
// menu of mutually exclusive options. Extracted from ThemeMenu (issue #40)
// when the footer-logo picker needed the same control (#97), and promoted out
// of the editor once the magazine settings and the members filter needed it
// too — the keyboard contract below is the reason it is shared rather than
// copied. This is an accessibility-sensitive app; one implementation means
// one place to fix.
//
// Accessible menu: opens on click (or ArrowDown), arrow keys move between
// options, Enter/Space selects, Escape closes and returns focus to the trigger,
// and an outside press dismisses it.
//
// Callers own what an option *is* — value, key and row content — so an option
// can be plain text (themes) or a mark thumbnail beside a name (logos). The
// check column is drawn here so every menu marks its current option alike.

export type MenuSelectItem<T> = {
  /** Stable React key — the value's own id, or a literal for a null value. */
  key: string;
  value: T;
  /** Row content, rendered after the shared check column. */
  content: ReactNode;
};

export function MenuSelect<T>({
  label,
  current,
  ariaLabel,
  items,
  value,
  onSelect,
  size = "sm",
  className = "",
}: {
  /** Trigger prefix — the control names itself, e.g. "Theme". */
  label: string;
  /** The current value's display text, shown in the trigger after `label`. */
  current: string;
  /** Accessible name for the menu itself. */
  ariaLabel: string;
  items: MenuSelectItem<T>[];
  value: T;
  onSelect: (value: T) => void;
  /** Trigger height: "sm" (40px) suits dense chrome like the editor header;
   * "md" (44px) sits beside full-size fields and meets the tap-target floor. */
  size?: "sm" | "md";
  /** Extra classes for the trigger — widths and placement only, as on Button. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Dismiss when a press lands outside the control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Capture, so the menu still dismisses inside a container that stops
    // pointer events on their way up — the montage dialog stops them at its
    // overlay to keep stray presses off the editor canvas behind it.
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // The checked option, kept where the focus effect below can read it without
  // depending on it. Callers build `items` inline (`OPTIONS.map(...)`), so the
  // array is a new object on every render of the host; an effect that listed it
  // re-ran whenever anything above re-rendered — an editor autosave tick, a
  // members-list refresh — and pulled focus off whatever option the user had
  // arrowed to, so the next Enter chose the wrong one (issue #136).
  const checkedRef = useRef(0);
  useEffect(() => {
    checkedRef.current = Math.max(
      0,
      items.findIndex((i) => i.value === value),
    );
  });

  // On open, move focus to the checked option so keyboard users land on it.
  // Only on open: from there the menu's own key handling owns focus.
  useEffect(() => {
    if (!open) return;
    itemsRef.current[checkedRef.current]?.focus();
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  };

  const choose = (next: T) => {
    onSelect(next);
    close();
  };

  const onItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    const n = items.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemsRef.current[(index + 1) % n]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemsRef.current[(index - 1 + n) % n]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itemsRef.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itemsRef.current[n - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // An open menu owns Escape: it closes itself and nothing else. The editor
      // canvas deselects the current block on a window-level Escape, and a
      // dialog hosting this control closes on one — either would fire out from
      // under a menu that was only meant to dismiss.
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      // Let focus move on naturally, but don't leave the menu hanging open
      // (nothing inside it would have focus, so Escape couldn't close it).
      close(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out select-none motion-safe:active:scale-[0.97] ${
          size === "md" ? "h-11" : "h-10"
        } ${className}`}
      >
        {label}: {current}
        <Icon name="chevronDown" size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="border-hair absolute top-full right-0 z-30 mt-1.5 min-w-[180px] rounded-lg border bg-white p-1 shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
        >
          {items.map((item, i) => {
            const active = item.value === value;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(item.value)}
                onKeyDown={(e) => onItemKeyDown(e, i)}
                className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 font-sans text-sm transition-[background-color,color] duration-150 ${
                  active
                    ? "text-accent font-semibold"
                    : "text-ink hover:bg-accent-wash"
                }`}
              >
                <span className="flex w-4 justify-center">
                  {active && <Icon name="check" size={15} strokeWidth={2} />}
                </span>
                {item.content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
