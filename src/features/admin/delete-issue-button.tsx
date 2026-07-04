"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteIssueAction } from "@/app/admin/actions";

// Delete one issue from the dashboard list. A client component so it can confirm
// before firing the (irreversible) server action; the action revalidates
// /admin, so the row disappears once it resolves.
export function DeleteIssueButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

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
          body="This permanently removes the issue and cannot be undone."
          confirmLabel="Delete issue"
          working={pending}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            startTransition(() => {
              void deleteIssueAction(id);
            });
          }}
        />
      )}
    </>
  );
}
