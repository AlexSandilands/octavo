"use client";

import { type IconName } from "./icons";
import { DialogShell } from "./dialog-shell";
import { DialogActions, DialogBody, DialogHeader } from "./dialog-parts";
import { Button } from "./ui";

// A shared, accessible confirmation dialog for destructive actions — the in-app
// replacement for scattered `window.confirm` alerts (issue #33). Mount it only
// while open (the caller keeps the open flag); DialogShell traps focus, closes
// on Escape or a backdrop press and returns focus to the trigger. Cancel leads
// in the markup, so the shell's initial focus lands on the safe button — never
// Confirm, since the action is irreversible.
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
      panelClassName="md:w-[460px]"
      locked={working}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <DialogHeader titleId={titleId} title={title} />
          <DialogBody>
            <p className="text-fg-muted mt-3 font-ui text-[17px] leading-relaxed">
              {body}
            </p>
          </DialogBody>
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={working}>
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              busy={working}
              icon={confirmIcon ?? undefined}
            >
              {working ? "Working…" : confirmLabel}
            </Button>
          </DialogActions>
        </>
      )}
    </DialogShell>
  );
}
