"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowAction } from "@/components/list-rows";
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
      <RowAction
        icon="trash"
        label="Delete"
        tone="danger"
        ariaLabel={`Delete ${title}`}
        title="Delete issue"
        disabled={pending}
        onClick={() => setConfirming(true)}
      />
      {confirming && (
        <ConfirmDialog
          title={`Delete “${title}”?`}
          body={
            <>
              This permanently removes the issue and cannot be undone.
              {failed && (
                <span
                  role="alert"
                  className="text-danger mt-2.5 block font-bold"
                >
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
