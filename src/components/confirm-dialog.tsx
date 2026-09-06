"use client";

import { type IconName } from "./icons";
import { DialogShell, dialogPanel } from "./dialog-shell";
import { DialogFooter, DialogTitle } from "./dialog-parts";
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
      panelClassName={dialogPanel("w-[460px]")}
      locked={working}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="px-7 pt-6">
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <p className="text-grey mt-3 font-ui text-[16px] leading-relaxed">
              {body}
            </p>
          </div>

          <DialogFooter>
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
          </DialogFooter>
        </>
      )}
    </DialogShell>
  );
}
