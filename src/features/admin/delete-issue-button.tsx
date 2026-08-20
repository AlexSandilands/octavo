"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteIssueAction } from "@/app/admin/actions";

// Delete one issue from the dashboard list. A client component so it can confirm
// before firing the (irreversible) server action.
//
// The transition awaits the action, so `pending` spans the revalidated
// re-render too: the dialog holds its working state until the row is really
// gone, rather than closing on a list that still shows it. A refusal or a throw
// keeps the dialog — and the row — with the reason on it.
export function DeleteIssueButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setConfirming(false);
    setFailed(false);
  };

  const remove = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        // On success the revalidated list unmounts this row, dialog and all.
        const res = await deleteIssueAction(id);
        if (!res.ok) setFailed(true);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(true)}
        title="Delete issue"
        aria-label={`Delete ${title}`}
        className="text-faint2 hover:text-warn hover:border-warn flex h-9 w-9 items-center justify-center rounded-lg border border-transparent disabled:opacity-40"
      >
        <Icon name="trash" size={17} strokeWidth={1.8} />
      </button>
      {confirming && (
        <ConfirmDialog
          title={`Delete “${title}”?`}
          body={
            <>
              This permanently removes the issue and cannot be undone.
              {failed && (
                <span role="alert" className="text-warn mt-2.5 block">
                  That didn’t work — the issue is still here. Please try again.
                </span>
              )}
            </>
          }
          confirmLabel="Delete issue"
          working={pending}
          onClose={close}
          onConfirm={remove}
        />
      )}
    </>
  );
}
