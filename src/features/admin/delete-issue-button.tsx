"use client";

import { useTransition } from "react";
import { Icon } from "@/components/icons";
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

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Delete “${title}”? This permanently removes the issue and cannot be undone.`,
          )
        ) {
          startTransition(() => {
            void deleteIssueAction(id);
          });
        }
      }}
      title="Delete issue"
      aria-label={`Delete ${title}`}
      className="text-faint2 hover:text-warn hover:border-warn flex h-9 w-9 items-center justify-center rounded-lg border border-transparent disabled:opacity-40"
    >
      <Icon name="trash" size={17} strokeWidth={1.8} />
    </button>
  );
}
