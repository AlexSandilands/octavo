"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DialogShell } from "@/components/dialog-shell";
import { Button } from "@/components/ui";
import type { RestoreOutcome } from "../use-editor-autosave";
import { pagesLabel, versionTime } from "./version-copy";

const FAILED: Record<string, string> = {
  conflict:
    "This issue was changed somewhere else since you opened it. Reload the editor, then try again.",
  missing: "That version is no longer kept.",
  invalid: "That version can’t be read any more.",
  unsaved:
    "Your latest edits couldn’t be saved, so nothing was restored. Try again once the editor says Saved.",
  error: "That didn’t work — nothing was changed. Please try again.",
};

// Confirms putting a kept version back (aboard #51), from the History tab and
// from the version's preview. The current pages are kept as a version first,
// which is what the dialog promises; a published issue changes for members at
// once, which it says too. On success `onDone` reloads — after a note when a
// cover logo had to be unlinked.
export function RestoreDialog({
  version,
  published,
  restore,
  onDone,
  onClose,
}: {
  version: { savedAt: string; pageCount: number };
  published: boolean;
  restore: () => Promise<RestoreOutcome>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState(0);

  const confirm = async () => {
    setWorking(true);
    setFailed(null);
    try {
      const result = await restore();
      if (!result.ok) {
        setFailed(result.reason);
        setWorking(false);
        return;
      }
      if (result.unlinkedLogos > 0) {
        setUnlinked(result.unlinkedLogos);
        setWorking(false);
        return;
      }
      onDone();
    } catch {
      setFailed("error");
      setWorking(false);
    }
  };

  if (unlinked > 0) {
    return (
      <DialogShell
        panelClassName="bg-card w-[440px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        onClose={onDone}
      >
        {(titleId) => (
          <>
            <div className="px-8 pt-7">
              <h2
                id={titleId}
                className="text-ink font-serif text-[24px] leading-tight"
              >
                Version restored
              </h2>
              <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
                {unlinked === 1
                  ? "One cover logo has been deleted from the logo library since then. Its picture is back on the cover, but it is no longer linked to the library."
                  : `${unlinked} cover logos have been deleted from the logo library since then. Their pictures are back on the cover, but no longer linked to the library.`}
              </p>
            </div>
            <div className="flex justify-end px-8 pt-6 pb-7">
              <Button onClick={onDone}>Open the restored issue</Button>
            </div>
          </>
        )}
      </DialogShell>
    );
  }

  return (
    <ConfirmDialog
      title="Restore this version?"
      body={
        <>
          The pages go back to the version from{" "}
          <span className="text-ink font-semibold">
            {versionTime(version.savedAt)}
          </span>{" "}
          ({pagesLabel(version.pageCount)}). The title, theme and footer mark
          stay as they are. The pages you have now are kept in History, so you
          can switch back.
          {published && (
            <span className="text-ink mt-2.5 block font-semibold">
              This issue is published: members will see the restored pages
              straight away.
            </span>
          )}
          {failed && (
            <span role="alert" className="text-warn mt-2.5 block">
              {FAILED[failed] ?? FAILED.error}
            </span>
          )}
        </>
      }
      confirmLabel="Restore"
      confirmIcon="history"
      confirmVariant="primary"
      working={working}
      onConfirm={() => void confirm()}
      onClose={onClose}
    />
  );
}
