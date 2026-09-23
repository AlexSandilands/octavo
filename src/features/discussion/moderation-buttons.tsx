"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { WriteResult } from "@/lib/comments";
import type { ThreadComment } from "@/lib/discussion-thread";
import { DELETE_COMMENT } from "@/lib/moderation-copy";
import { ActionButton } from "./action-button";

export type ModerationAction = "hide" | "unhide" | "delete";
export type Moderate = (action: ModerationAction) => Promise<WriteResult>;

const FAILED = "That didn’t go through. Please try again.";

// An admin's Hide / Unhide and Delete in the thread (issue #302). Hiding can be
// undone, so it acts at once — one button whose label flips, so focus stays on
// it; Delete can't, so it asks first. On their own comment an admin keeps the
// member's Delete, so only Hide is added here.
export function ModerationButtons({
  comment,
  onModerate,
}: {
  comment: ThreadComment;
  onModerate: Moderate;
}) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (action: ModerationAction) => {
    if (pending) return;
    setFailed(null);
    startTransition(async () => {
      const result = await onModerate(action).catch(() => ({
        ok: false as const,
        reason: FAILED,
      }));
      if (result.ok) setConfirming(false);
      else setFailed(result.reason);
    });
  };

  const hidden = comment.hidden === true;
  const about = comment.isMine ? "your comment" : `${comment.name}’s comment`;
  return (
    <>
      <ActionButton
        onClick={() => act(hidden ? "unhide" : "hide")}
        label={`${hidden ? "Unhide" : "Hide"} ${about}`}
      >
        {hidden ? "Unhide" : "Hide"}
      </ActionButton>
      {!comment.isMine && (
        <ActionButton
          onClick={() => {
            setFailed(null);
            setConfirming(true);
          }}
          label={`Delete ${about}`}
        >
          Delete
        </ActionButton>
      )}
      {failed && !confirming && (
        <p role="alert" className="text-warn basis-full px-2 text-[14px]">
          {failed}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title={DELETE_COMMENT.title}
          body={
            <>
              {DELETE_COMMENT.body} This can’t be undone.
              {failed && (
                <span role="alert" className="text-warn mt-2.5 block">
                  {failed}
                </span>
              )}
            </>
          }
          confirmLabel={DELETE_COMMENT.confirm}
          working={pending}
          onClose={() => {
            setConfirming(false);
            setFailed(null);
          }}
          onConfirm={() => act("delete")}
        />
      )}
    </>
  );
}
