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
        className="text-fg-muted hover:border-primary hover:bg-primary-wash hover:text-primary border-edge flex h-11 w-[84px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-dashed font-ui text-[13px] font-bold transition-colors"
      >
        <Icon name="plus" size={16} strokeWidth={2} />
        Add
      </button>
      {open && (
        <>
          {/* Click-off backdrop */}
          <div className="fixed inset-0 z-20" onClick={onClose} />
          <div
            ref={menuRef}
            className={`bg-surface border-hairline shadow-float rise-in absolute left-[92px] z-30 w-64 overflow-hidden rounded-card border p-1.5 ${
              up ? "bottom-0" : "top-0"
            }`}
          >
            {PAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onAdd(t.id)}
                className="hover:bg-primary-wash block w-full cursor-pointer rounded-field px-3 py-2.5 text-left transition-colors"
              >
                <div className="text-fg font-ui text-[15px] font-bold">
                  {t.label}
                </div>
                <div className="text-fg-muted mt-0.5 font-ui text-[13px] leading-snug">
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
