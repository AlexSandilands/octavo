"use client";

import { type IconName } from "./icons";
import { DialogShell } from "./dialog-shell";
import { Button } from "./ui";

// A shared, accessible confirmation dialog for destructive actions — the in-app
// replacement for scattered `window.confirm` alerts (issue #33), styled like the
// sponsor / publish dialogs so the flows feel of a piece. Mount it only while
// open (the caller keeps the open flag); DialogShell traps focus, closes on
// Escape or an outside/backdrop press and returns focus to the trigger. Cancel
// leads in the markup, so the shell's initial focus lands on the safe button —
// never Confirm, since the action is irreversible.
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
  return (
    <DialogShell
      panelClassName="bg-card w-[440px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      locked={working}
      closeOnOverlayPress
      onClose={onClose}
    >
      {(titleId) => (
        <>
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
            <Button variant="secondary" onClick={onClose} disabled={working}>
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
        </>
      )}
    </DialogShell>
  );
}
