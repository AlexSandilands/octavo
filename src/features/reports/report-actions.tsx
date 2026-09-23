"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import {
  FORMER_MEMBER,
  type ReportView,
  type WriteResult,
} from "@/lib/comments";
import {
  clearNameAvatarAction,
  deleteReportedCommentAction,
  hideReportedCommentAction,
  resolveReportAction,
  retireNameAction,
  unhideReportedCommentAction,
} from "@/app/admin/reports/actions";

type Confirming = "delete" | "avatar" | "retire" | null;

// A report's actions. Those that need the comment (or its name) stay in the
// tab order but go unavailable once it is gone — `unavailable`, not
// `disabled`, so the button just pressed keeps focus (#131). Hide, Unhide and
// Resolve act at once; the three that can't be taken back confirm first.
export function ReportActions({
  report,
  onDone,
}: {
  report: ReportView;
  onDone: (outcome: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const comment = report.current.state === "deleted" ? null : report.current;
  const name = report.name;
  const by = report.snapshot.name ?? FORMER_MEMBER;

  const act = (write: () => Promise<WriteResult>, outcome: string) => {
    setError(null);
    setConfirming(null);
    startTransition(async () => {
      const result = await write();
      if (result.ok) onDone(outcome);
      else setError(result.reason);
    });
  };

  const gone = "The comment is no longer there.";

  return (
    <div className={pending ? "opacity-60" : undefined}>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {comment?.hidden ? (
          <Button
            variant="secondary"
            unavailable={pending}
            aria-label={`Unhide comment by ${by}`}
            onClick={() =>
              act(
                () => unhideReportedCommentAction(comment.commentId),
                "Comment shown again.",
              )
            }
          >
            Unhide comment
          </Button>
        ) : (
          <Button
            variant="secondary"
            unavailable={pending || !comment}
            title={comment ? undefined : gone}
            aria-label={`Hide comment by ${by}`}
            onClick={() =>
              comment &&
              act(
                () => hideReportedCommentAction(comment.commentId),
                "Comment hidden and its reports resolved.",
              )
            }
          >
            Hide comment
          </Button>
        )}
        <Button
          variant="secondary"
          unavailable={pending || !comment}
          title={comment ? undefined : gone}
          aria-label={`Delete comment by ${by}`}
          onClick={() => setConfirming("delete")}
        >
          Delete comment
        </Button>
        {report.status === "open" && (
          <Button
            variant="secondary"
            unavailable={pending}
            aria-label={`Resolve report of the comment by ${by}`}
            onClick={() =>
              act(() => resolveReportAction(report.id), "Report resolved.")
            }
          >
            Resolve
          </Button>
        )}
        <Button
          variant="secondary"
          unavailable={pending || !name?.avatarUrl}
          title={name?.avatarUrl ? undefined : "This name has no picture."}
          aria-label={`Clear avatar for ${name?.name ?? by}`}
          onClick={() => setConfirming("avatar")}
        >
          Clear avatar
        </Button>
        <Button
          variant="secondary"
          unavailable={pending || !name || name.retired}
          title={!name ? gone : name.retired ? "Already retired." : undefined}
          aria-label={`Retire name ${name?.name ?? by}`}
          onClick={() => setConfirming("retire")}
        >
          {name?.retired ? "Name retired" : "Retire name"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-warn mt-2 font-sans text-[14px]">
          {error}
        </p>
      )}

      {confirming === "delete" && comment && (
        <ConfirmDialog
          title="Delete this comment?"
          body="Members won’t see it again, and its open reports are resolved. If it has replies they stay, under “Comment removed”. The report keeps the comment as it was reported. This can’t be undone."
          confirmLabel="Delete comment"
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            act(
              () => deleteReportedCommentAction(comment.commentId),
              "Comment deleted and its reports resolved.",
            )
          }
        />
      )}
      {confirming === "avatar" && name && (
        <ConfirmDialog
          title={`Clear the picture for “${name.name}”?`}
          body="The name shows its initials instead, on every comment posted under it. The picture is deleted and can’t be brought back; the member can choose a new one."
          confirmLabel="Clear avatar"
          confirmIcon="close"
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            act(() => clearNameAvatarAction(name.id), "Avatar cleared.")
          }
        />
      )}
      {confirming === "retire" && name && (
        <ConfirmDialog
          title={`Retire the name “${name.name}”?`}
          body="It comes off the member’s list of names, so they can’t post under it. Comments already posted under it keep it. The member could add it again from their profile, so if the name itself is the problem, tell them why."
          confirmLabel="Retire name"
          confirmIcon="minus"
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            act(() => retireNameAction(name.id), "Name retired.")
          }
        />
      )}
    </div>
  );
}
