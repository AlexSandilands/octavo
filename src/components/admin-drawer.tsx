"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "./ui";
import { Icon } from "./icons";

// Mobile chrome for the admin shell (issue #57). Below `md` the fixed desktop
// rail is hidden and this renders instead: a slim top bar with a menu button
// that opens the nav as a left off-canvas drawer. At `md`+ the whole island is
// hidden (`md:hidden`) and the desktop rail takes over unchanged.
//
// The nav column is passed in as `children` (the shared <AdminNavContent>), so
// this file owns only the open/close behaviour: focus trap, Escape to close,
// close-on-link-selection (click delegation — the links themselves stay server
// rendered), a backdrop press to dismiss, and marking the page content behind
// the overlay inert so it's out of the tab order and the accessibility tree.
export function AdminDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on open; restore focus to the menu button on close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [open]);

  // The page content behind the drawer (the scrollable <main>) is made inert
  // while open so it's skipped by Tab and hidden from assistive tech; the body
  // scroll is locked so a backdrop drag doesn't move the page underneath.
  useEffect(() => {
    if (!open) return;
    const main = document.getElementById("admin-main");
    main?.setAttribute("inert", "");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      main?.removeAttribute("inert");
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // If the viewport grows past md while open (tablet rotation), the overlay is
  // hidden by `md:hidden` but `open` would still hold the page inert — close it.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 48rem)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  // Escape closes; Tab is trapped within the drawer's focusable controls.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Top bar — only below md; hidden once the desktop rail appears. */}
      <div
        className="bg-paper border-line flex flex-none items-center gap-2 border-b px-3 py-2 md:hidden"
        inert={open}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="text-ink hover:text-accent flex h-11 w-11 flex-none items-center justify-center rounded-lg"
        >
          <Icon name="menu" size={24} />
        </button>
        <Wordmark size={20} />
        <span className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
          Admin
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop — a press anywhere outside the panel dismisses. */}
          <button
            type="button"
            aria-label="Close admin menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(32,32,28,0.4)]"
          />
          <div
            ref={panelRef}
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            onClick={(e) => {
              // Close when a nav link is chosen; navigation proceeds via Link.
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
            className="bg-paper border-line relative flex w-[280px] max-w-[85vw] flex-none flex-col border-r py-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="text-muted hover:text-accent absolute top-3 right-2 flex h-11 w-11 items-center justify-center rounded-lg"
            >
              <Icon name="close" size={22} />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
