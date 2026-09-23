"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { WriteResult } from "@/lib/comments";
import type { ThreadComment } from "@/lib/discussion-thread";
import { ReportDialog } from "./report-dialog";

// The small row under a comment (issue #301): Reply on top-level comments;
// Edit and Delete on your own; Report on anyone else's. Admins get no Report —
// their Hide and Delete arrive with #302's in-thread moderation, here.
export function CommentActions({
  comment,
  viewer,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: ThreadComment;
  viewer: "member" | "admin";
  /** Absent on replies: there is no replying to a reply. */
  onReply?: () => void;
  onEdit: () => void;
  onDelete: () => Promise<WriteResult>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await onDelete().catch(() => ({
        ok: false as const,
        reason: "That didn’t go through. Please try again.",
      }));
      if (result.ok) setConfirming(false);
      else setFailed(result.reason);
    });

  const about = `${comment.name}’s comment`;
  return (
    <div className="-ml-2 flex flex-wrap items-center">
      {onReply && (
        <ActionButton onClick={onReply} label={`Reply to ${about}`}>
          Reply
        </ActionButton>
      )}
      {comment.isMine && (
        <>
          <ActionButton onClick={onEdit} label="Edit your comment">
            Edit
          </ActionButton>
          <ActionButton
            onClick={() => {
              setFailed(null);
              setConfirming(true);
            }}
            label="Delete your comment"
          >
            Delete
          </ActionButton>
        </>
      )}
      {!comment.isMine && viewer === "member" && (
        <ActionButton
          onClick={() => setReporting(true)}
          label={`Report ${about}`}
        >
          Report
        </ActionButton>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete your comment?"
          body={
            <>
              It’s removed for everyone and can’t be undone. Any replies stay,
              under “Comment removed”.
              {failed && (
                <span role="alert" className="text-warn mt-2.5 block">
                  {failed}
                </span>
              )}
            </>
          }
          confirmLabel="Delete comment"
          working={pending}
          onClose={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
      {reporting && (
        <ReportDialog
          commentId={comment.id}
          name={comment.name}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-faint hover:text-accent hover:bg-accent-wash inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-2 font-sans text-[14px] font-semibold transition-colors"
    >
      {children}
    </button>
  );
}
