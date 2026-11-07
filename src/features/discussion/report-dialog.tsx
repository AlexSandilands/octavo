"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { StaleActionNotice } from "@/components/stale-action-notice";
import { Button, IconButton } from "@/components/ui";
import { draftRestored, isStaleAction } from "@/lib/stale-action";
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/comments";
import { reportCommentAction } from "@/app/read/[issueId]/actions";

// Report someone else's comment (issue #301): a reason, an optional note, and
// a thank-you whether or not it was a duplicate (epic #298) — but never when
// the call itself didn't reach the server, so a report isn't silently dropped.
// Rendered inside the discussion panel, so it stacks over the drawer or sheet
// and hands the keyboard back when it closes. A stale failure keeps the reason
// and note for the reload (#132), which reopens the dialog with them.
export function ReportDialog({
  commentId,
  name,
  onClose,
  keep,
  restored,
}: {
  commentId: string;
  name: string;
  onClose: () => void;
  keep?: (reason: ReportReason | null, note: string) => boolean;
  restored?: { reason: ReportReason | null; note: string };
}) {
  const [reason, setReason] = useState(restored?.reason ?? null);
  const [note, setNote] = useState(restored?.note ?? "");
  const [kept, setKept] = useState(false);
  const [welcome, setWelcome] = useState(restored !== undefined);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLButtonElement>(null);
  const noteId = useId();

  // A restored report opens on its note, caret at the end (after the shell
  // has put focus on its first control).
  useEffect(() => {
    const el = noteRef.current;
    if (!restored || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // Once, as it opens with the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setError(null);
    setStale(false);
    setFailed(false);
    setWelcome(false);
    startTransition(async () => {
      try {
        await reportCommentAction({
          commentId,
          reason,
          note: note.trim() === "" ? null : note,
        });
      } catch (err) {
        // An outdated page: only a reload files it (#403).
        if (isStaleAction(err)) {
          setKept(keep?.(reason, note) ?? false);
          setStale(true);
        } else setFailed(true);
        return;
      }
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
                          setWelcome(false);
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
                ref={noteRef}
                id={noteId}
                rows={3}
                value={note}
                maxLength={REPORT_NOTE_MAX}
                onChange={(e) => {
                  setNote(e.target.value);
                  setWelcome(false);
                }}
                className="text-ink border-line mt-2 w-full resize-none rounded-lg border-[1.5px] bg-white px-3.5 py-2.5 font-sans text-[16px]"
              />
              {welcome && (
                <p className="text-muted mt-3 font-sans text-[14px] leading-snug">
                  {draftRestored("Send report")}
                </p>
              )}
              {stale && (
                <StaleActionNotice typed kept={kept} className="mt-3" />
              )}
              {failed && (
                <p
                  role="alert"
                  className="text-warn mt-3 font-sans text-[14px]"
                >
                  That didn’t go through. Please try again.
                </p>
              )}
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
