"use client";

import { useEffect, useRef, useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
} from "@/components/dialog-parts";
import { Icon } from "@/components/icons";
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
      panelClassName="md:w-[500px]"
      locked={working}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          {phase === "done" ? (
            <ResultBody titleId={titleId} number={number} result={result} />
          ) : (
            <>
              <DialogHeader
                titleId={titleId}
                kicker="Publish & send"
                title={`Publish issue No. ${number}?`}
              />
              <DialogBody>
                <p className="text-fg-muted mt-2 font-ui text-[16px] leading-relaxed">
                  This marks the issue published so members can read it.
                </p>

                <label
                  className={`boxed-field border-edge bg-surface mt-5 flex items-start gap-3 rounded-field border-[1.5px] p-4 transition-colors ${
                    canEmail
                      ? "hover:border-primary cursor-pointer"
                      : "opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={willEmail}
                    disabled={!canEmail || working}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="accent-primary mt-0.5 h-6 w-6 flex-none"
                  />
                  <span className="font-ui text-[16px] leading-snug">
                    <span className="text-fg font-bold">
                      Email the new issue
                    </span>
                    <span className="text-fg-muted mt-0.5 block">
                      {canEmail
                        ? `Sends a personal “Read issue” link to ${subscriberCount} subscribed ${
                            subscriberCount === 1 ? "member" : "members"
                          }.`
                        : "No subscribed members to email yet."}
                    </span>
                  </span>
                </label>
              </DialogBody>
            </>
          )}

          <DialogActions>
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
                <Button onClick={run} busy={working} icon="check">
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
          </DialogActions>
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
        <DialogHeader
          titleId={titleId}
          kicker="Publish & send"
          title={<span className="text-danger">Publish failed.</span>}
        />
        <DialogBody>
          <p className="text-fg-muted mt-2 font-ui text-[16px] leading-relaxed">
            Issue No. {number} couldn&rsquo;t be published. Nothing was sent —
            try again.
          </p>
        </DialogBody>
      </>
    );
  }

  const emailed = result.emailed;
  return (
    <>
      <DialogHeader
        titleId={titleId}
        kicker="Publish & send"
        title={`Issue No. ${number} is live.`}
      />
      <DialogBody>
        <p className="bg-ok-soft text-fg mt-3 flex items-start gap-3 rounded-field p-4 font-ui text-[16px] leading-relaxed">
          <Icon
            name="checkCircle"
            size={22}
            strokeWidth={2}
            className="text-ok mt-0.5 flex-none"
          />
          <span>
            {emailed === null
              ? "Published without emailing members."
              : emailed.failed === 0
                ? `Emailed ${emailed.sent} ${
                    emailed.sent === 1 ? "member" : "members"
                  }.`
                : `Emailed ${emailed.sent} ${
                    emailed.sent === 1 ? "member" : "members"
                  }, ${emailed.failed} failed. The failures are logged — you can re-publish to retry them.`}
          </span>
        </p>
      </DialogBody>
    </>
  );
}
