"use client";

import { useEffect, useRef, useState } from "react";
import { DialogShell, dialogPanel } from "@/components/dialog-shell";
import { DialogFooter, DialogTitle } from "@/components/dialog-parts";
import { Button } from "@/components/ui";
import type { PublishResult } from "@/app/admin/actions";

// Confirmation dialog shown before publishing an issue. Pulled out of the editor
// to keep that file under the 500-line limit (docs/design-principles.md).
//
// It owns the whole publish interaction now: the email opt-in, the "publishing…"
// state, and the sent/failed result. `onPublish` does the actual work (flush +
// server action) and hands back the outcome.
//
// The backdrop is the shell's viewport-fixed one (issue #153). It used to be
// `absolute inset-0` against the editor root, which could then grow taller than
// the viewport — and an absolute overlay on a taller-than-viewport editor
// centres the panel on the document rather than on what the admin is looking at.

type Phase = "confirm" | "working" | "done";

export function PublishModal({
  number,
  subscriberCount,
  alreadyPublished,
  onClose,
  onPublish,
}: {
  number: number;
  subscriberCount: number;
  // Re-publishing an already-live issue defaults the email OFF, so a small
  // correction can't accidentally re-blast the whole list.
  alreadyPublished: boolean;
  onClose: () => void;
  onPublish: (sendEmail: boolean) => Promise<PublishResult>;
}) {
  const [sendEmail, setSendEmail] = useState(!alreadyPublished);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [result, setResult] = useState<PublishResult | null>(null);
  const draftRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const canEmail = subscriberCount > 0;
  const willEmail = sendEmail && canEmail;
  const working = phase === "working";

  // Each phase says where focus goes, because each one takes away the control
  // the admin was standing on: pressing Publish switches that button off under
  // their hands (#131), and the result swaps both buttons for a single Done
  // (#133). Either way focus would land on <body> — and with the page behind
  // held inert (#154) that is nowhere at all, for a publish + blast that can run
  // for seconds. The shell's trap would pull it back, but only on the next Tab,
  // and nobody should have to press a key to find out where they are.
  //
  // Which is why "Keep as draft" is `unavailable` rather than `disabled` while
  // the publish is in flight: it looks and behaves exactly as disabled did, but
  // it is still there to stand on.
  useEffect(() => {
    if (phase === "working") draftRef.current?.focus();
    if (phase === "done") doneRef.current?.focus();
  }, [phase]);

  const run = async () => {
    setPhase("working");
    const res = await onPublish(willEmail);
    setResult(res);
    setPhase("done");
  };

  return (
    <DialogShell
      panelClassName={dialogPanel("w-[500px]")}
      locked={working}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="px-7 pt-6">
            {phase === "done" ? (
              <ResultBody titleId={titleId} number={number} result={result} />
            ) : (
              <>
                <DialogTitle id={titleId} kicker="Publish & send">
                  Publish issue No. {number}?
                </DialogTitle>
                <p className="text-grey mt-3 font-ui text-[16px] leading-relaxed">
                  This marks the issue published so members can read it.
                </p>

                <label
                  className={`boxed-field border-lead bg-sheet mt-5 flex items-start gap-3 rounded-ui border p-4 ${
                    canEmail ? "cursor-pointer" : "opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={willEmail}
                    disabled={!canEmail || working}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="accent-red mt-1 h-5 w-5 flex-none"
                  />
                  <span className="font-ui text-[16px] leading-snug">
                    <span className="text-lead font-semibold">
                      Email the new issue
                    </span>
                    <span className="text-grey mt-0.5 block text-[15px]">
                      {canEmail
                        ? `Sends a personal “Read issue” link to ${subscriberCount} subscribed ${
                            subscriberCount === 1 ? "member" : "members"
                          }.`
                        : "No subscribed members to email yet."}
                    </span>
                  </span>
                </label>
              </>
            )}
          </div>

          <DialogFooter>
            {phase === "done" ? (
              <Button ref={doneRef} onClick={onClose}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  ref={draftRef}
                  variant="secondary"
                  onClick={onClose}
                  unavailable={working}
                >
                  Keep as draft
                </Button>
                <Button
                  onClick={run}
                  busy={working}
                  icon="check"
                  iconPosition="left"
                >
                  {working
                    ? willEmail
                      ? "Publishing & sending…"
                      : "Publishing…"
                    : willEmail
                      ? "Publish & send"
                      : "Publish"}
                </Button>
              </>
            )}
          </DialogFooter>
        </>
      )}
    </DialogShell>
  );
}

function ResultBody({
  titleId,
  number,
  result,
}: {
  titleId: string;
  number: number;
  result: PublishResult | null;
}) {
  if (!result || !result.ok) {
    return (
      <>
        <DialogTitle id={titleId} kicker="Publish & send">
          Publish failed.
        </DialogTitle>
        <p
          role="alert"
          className="border-l-red text-grey mt-4 border-l-4 pl-4 font-ui text-[16px] leading-relaxed"
        >
          Issue No. {number} couldn&rsquo;t be published. Nothing was sent — try
          again.
        </p>
      </>
    );
  }

  const emailed = result.emailed;
  return (
    <>
      <DialogTitle id={titleId} kicker="Publish & send">
        Issue No. {number} is live.
      </DialogTitle>
      <p className="text-grey mt-3 font-ui text-[16px] leading-relaxed">
        {emailed === null
          ? "Published without emailing members."
          : emailed.failed === 0
            ? `Emailed ${emailed.sent} ${
                emailed.sent === 1 ? "member" : "members"
              }.`
            : `Emailed ${emailed.sent} ${
                emailed.sent === 1 ? "member" : "members"
              }, ${emailed.failed} failed. The failures are logged — you can re-publish to retry them.`}
      </p>
    </>
  );
}
