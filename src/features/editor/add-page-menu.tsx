"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { PAGE_TEMPLATES, type PageTemplate } from "@/lib/blocks";

// The page rail's "Add page" control and its template menu. The menu pops out
// to the right of the button, bottom-aligned with it; when that would run off
// the bottom of the viewport it hangs upward from the button instead, so no
// part of it is ever clipped.
export function AddPageMenu({
  open,
  onToggle,
  onClose,
  onAdd,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAdd: (template: PageTemplate) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);

  // Measured on open, before paint: the menu's height is only known once it
  // is in the DOM. Flips up only when that side actually has the room.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current?.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    if (!anchor) return;
    setUp(
      anchor.top + height > window.innerHeight && anchor.bottom - height >= 0,
    );
  }, [open]);

  return (
    <div ref={anchorRef} className="relative flex-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-lead border-lead hover:bg-newsprint flex h-11 w-[120px] cursor-pointer items-center justify-center gap-1.5 rounded-ui border border-dashed font-ui text-[14px] font-semibold transition-colors"
      >
        <Icon name="plus" size={15} strokeWidth={2} />
        Add page
      </button>
      {open && (
        <>
          {/* Click-off backdrop */}
          <div className="fixed inset-0 z-20" onClick={onClose} />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Page templates"
            className={`bg-sheet border-lead absolute left-[128px] z-30 w-60 overflow-hidden border ${
              up ? "bottom-0" : "top-0"
            }`}
          >
            {PAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                onClick={() => onAdd(t.id)}
                className="rule-hair hover:bg-newsprint block w-full cursor-pointer px-3.5 py-2.5 text-left first:border-t-0"
              >
                <div className="text-lead font-ui text-[15px] font-semibold">
                  {t.label}
                </div>
                <div className="text-grey mt-0.5 font-ui text-[13px] leading-snug">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
