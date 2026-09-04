"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { PAGE_TEMPLATES, type PageTemplate } from "@/lib/blocks";

// The page rail's "Add" control and its template menu. The menu pops out to
// the right of the button, top-aligned; when that would run off the bottom of
// the viewport (the control sits low on a long issue) it hangs upward from the
// button instead, so no part of it is ever clipped.
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
        onClick={onToggle}
        aria-expanded={open}
        className="text-faint hover:border-accent hover:text-accent border-dash flex h-10 w-[84px] items-center justify-center gap-1.5 rounded-[3px] border-[1.5px] border-dashed font-sans text-[11px] font-semibold"
      >
        <Icon name="plus" size={14} strokeWidth={1.8} />
        Add
      </button>
      {open && (
        <>
          {/* Click-off backdrop */}
          <div className="fixed inset-0 z-20" onClick={onClose} />
          <div
            ref={menuRef}
            className={`bg-card border-hair-warm absolute left-[92px] z-30 w-56 overflow-hidden rounded-lg border shadow-[0_12px_32px_rgba(40,36,28,0.18)] ${
              up ? "bottom-0" : "top-0"
            }`}
          >
            {PAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onAdd(t.id)}
                className="hover:bg-accent-wash block w-full px-3.5 py-2.5 text-left"
              >
                <div className="text-ink font-sans text-[13px] font-semibold">
                  {t.label}
                </div>
                <div className="text-faint2 mt-0.5 font-sans text-[11px] leading-snug">
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
