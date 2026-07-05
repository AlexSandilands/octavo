"use client";

import { useEffect, useId, useRef } from "react";
import { type IconName } from "./icons";
import { Button } from "./ui";

// A shared, accessible confirmation dialog for destructive actions — the in-app
// replacement for scattered `window.confirm` alerts (issue #33), styled like the
// sponsor / publish dialogs so the flows feel of a piece. Mount it only while
// open (the caller keeps the open flag); it traps focus, closes on Escape or an
// outside/backdrop press, returns focus to the trigger on close, and — since the
// action is irreversible — focuses the safe Cancel button, never Confirm.
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmIcon = "trash",
  working = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Icon on the confirm button; pass null for none. */
  confirmIcon?: IconName | null;
  /** Disables both buttons while the action runs. */
  working?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Focus the safe button on open and restore focus to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => trigger?.focus?.();
  }, []);

  // Escape closes; Tab is trapped within the dialog's focusable controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
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
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card w-[440px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="px-8 pt-7">
          <h2
            id={titleId}
            className="text-ink font-serif text-[24px] leading-tight"
          >
            {title}
          </h2>
          <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
            {body}
          </p>
        </div>

        <div className="flex justify-end gap-3 px-8 pt-6 pb-7">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            disabled={working}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            busy={working}
            icon={confirmIcon ?? undefined}
            iconPosition="left"
          >
            {working ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
