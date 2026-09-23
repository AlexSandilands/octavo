"use client";

import { useId, useRef, useState, useTransition } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { Button, IconButton } from "@/components/ui";
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/comments";
import { reportCommentAction } from "@/app/read/[issueId]/actions";

// Report someone else's comment (issue #301): a reason, an optional note, and
// always a thank-you — whether or not it was a duplicate, it never fails
// visibly (epic #298). Rendered inside the discussion panel, so it stacks over
// the drawer or sheet and hands the keyboard back when it closes.
export function ReportDialog({
  commentId,
  name,
  onClose,
}: {
  commentId: string;
  name: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLButtonElement>(null);
  const noteId = useId();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    startTransition(async () => {
      await reportCommentAction({
        commentId,
        reason,
        note: note.trim() === "" ? null : note,
      }).catch(() => null);
      setSent(true);
      requestAnimationFrame(() => doneRef.current?.focus());
    });
  };

  return (
    <DialogShell
      panelClassName="bg-card w-[440px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      locked={pending}
      onClose={onClose}
    >
      {(titleId) => (
        <div className="px-6 pt-6 pb-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <h2
              id={titleId}
              className="text-ink font-serif text-[24px] leading-tight"
            >
              Report this comment
            </h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
          {sent ? (
            <>
              <p
                role="status"
                className="text-body mt-4 font-sans text-[16px] leading-relaxed"
              >
                Thanks — an admin will take a look.
              </p>
              <div className="mt-6 flex justify-end">
                <Button ref={doneRef} onClick={onClose} size="compact">
                  Done
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={send} noValidate>
              <p className="text-muted mt-2 font-sans text-[15px] leading-relaxed">
                Tell an admin what’s wrong with the comment by {name}. They
                won’t tell anyone who reported it.
              </p>
              <fieldset className="mt-4">
                <legend className="text-ink font-sans text-[15px] font-semibold">
                  Reason
                </legend>
                <div className="mt-1.5 flex flex-col">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      className="text-ink flex min-h-11 cursor-pointer items-center gap-3 font-sans text-[16px]"
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => {
                          setReason(r);
                          setError(null);
                        }}
                        className="accent-accent h-5 w-5 flex-none cursor-pointer"
                      />
                      {REPORT_REASON_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p
                  role="alert"
                  className="text-warn mt-1 font-sans text-[14px]"
                >
                  {error}
                </p>
              )}
              <label
                htmlFor={noteId}
                className="text-ink mt-4 block font-sans text-[15px] font-semibold"
              >
                Anything else?{" "}
                <span className="text-faint font-normal">(optional)</span>
              </label>
              <textarea
                id={noteId}
                rows={3}
                value={note}
                maxLength={REPORT_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                className="text-ink border-line mt-2 w-full resize-none rounded-lg border-[1.5px] bg-white px-3.5 py-2.5 font-sans text-[16px]"
              />
              <div className="mt-5 flex justify-end gap-1">
                <Button
                  variant="quiet"
                  size="compact"
                  className="px-3"
                  onClick={onClose}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="compact" busy={pending}>
                  {pending ? "Sending…" : "Send report"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </DialogShell>
  );
}
