"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type {
  LayoutTheme,
  LayoutThemeId,
} from "@/features/blocks/themes/registry";

// The editor header's layout-theme picker: a real dropdown listing the
// deployment-enabled themes with the current one checked. It replaced a
// click-to-cycle control that read as a dropdown but stepped through themes —
// misleading, and awkward once more than two themes are enabled (issue #33).
// Accessible menu: opens on click (or ArrowDown), arrow keys move between
// options, Enter/Space selects, Escape closes and returns focus to the trigger,
// and an outside press dismisses it.
export function ThemeMenu({
  themes,
  themeId,
  onSelect,
}: {
  themes: LayoutTheme[];
  themeId: LayoutThemeId;
  onSelect: (id: LayoutThemeId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const current = themes.find((t) => t.id === themeId);

  // Dismiss when a press lands outside the control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // On open, move focus to the checked option so keyboard users land on it.
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      themes.findIndex((t) => t.id === themeId),
    );
    itemsRef.current[idx]?.focus();
  }, [open, themeId, themes]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  };

  const choose = (id: LayoutThemeId) => {
    onSelect(id);
    close();
  };

  const onItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    const n = themes.length;
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
        className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex h-10 items-center gap-2 rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out select-none motion-safe:active:scale-[0.97]"
      >
        Theme: {current?.name ?? ""}
        <Icon name="chevronDown" size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Layout theme"
          className="border-hair absolute top-full right-0 z-30 mt-1.5 min-w-[180px] rounded-lg border bg-white p-1 shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
        >
          {themes.map((t, i) => {
            const active = t.id === themeId;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(t.id)}
                onKeyDown={(e) => onItemKeyDown(e, i)}
                className={`flex h-11 w-full items-center gap-2 rounded-md px-2.5 font-sans text-sm ${
                  active
                    ? "text-accent font-semibold"
                    : "text-ink hover:bg-accent-wash"
                }`}
              >
                <span className="flex w-4 justify-center">
                  {active && <Icon name="check" size={15} strokeWidth={2} />}
                </span>
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
