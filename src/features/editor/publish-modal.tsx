"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type { PublishResult } from "@/app/admin/actions";

// Confirmation dialog shown before publishing an issue. Pulled out of the editor
// to keep that file under the 500-line limit (docs/design-principles.md).
//
// It owns the whole publish interaction now: the email opt-in, the "publishing…"
// state, and the sent/failed result. `onPublish` does the actual work (flush +
// server action) and hands back the outcome.

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

  const canEmail = subscriberCount > 0;
  const willEmail = sendEmail && canEmail;

  const run = async () => {
    setPhase("working");
    const res = await onPublish(willEmail);
    setResult(res);
    setPhase("done");
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        className="bg-card w-[480px] overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="px-8 pt-7">
          <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Publish &amp; send
          </div>

          {phase === "done" ? (
            <ResultBody number={number} result={result} />
          ) : (
            <>
              <h2
                id="publish-modal-title"
                className="text-ink mt-3 font-serif text-[27px] leading-tight"
              >
                Publish issue No. {number}?
              </h2>
              <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
                This marks the issue published so members can read it.
              </p>

              <label
                className={`border-hair mt-5 flex items-start gap-3 rounded-lg border-[1.5px] bg-white p-4 ${
                  canEmail ? "cursor-pointer" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={willEmail}
                  disabled={!canEmail || phase === "working"}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="accent-accent mt-0.5 h-5 w-5 flex-none"
                />
                <span className="font-sans text-[14px] leading-snug">
                  <span className="text-ink font-semibold">
                    Email the new issue
                  </span>
                  <span className="text-muted mt-0.5 block">
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

        <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
          {phase === "done" ? (
            <button
              onClick={onClose}
              className="bg-accent text-paper flex h-12 items-center rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)]"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={phase === "working"}
                className="border-hair text-ink flex h-12 items-center rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold disabled:opacity-50"
              >
                Keep as draft
              </button>
              <button
                onClick={run}
                disabled={phase === "working"}
                className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)] disabled:opacity-70"
              >
                <Icon name="check" size={18} strokeWidth={1.8} />
                {phase === "working"
                  ? willEmail
                    ? "Publishing & sending…"
                    : "Publishing…"
                  : willEmail
                    ? "Publish & send"
                    : "Publish"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultBody({
  number,
  result,
}: {
  number: number;
  result: PublishResult | null;
}) {
  if (!result || !result.ok) {
    return (
      <>
        <h2
          id="publish-modal-title"
          className="text-warn mt-3 font-serif text-[27px] leading-tight"
        >
          Publish failed.
        </h2>
        <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
          Issue No. {number} couldn&rsquo;t be published. Nothing was sent — try
          again.
        </p>
      </>
    );
  }

  const emailed = result.emailed;
  return (
    <>
      <h2
        id="publish-modal-title"
        className="text-ink mt-3 font-serif text-[27px] leading-tight"
      >
        Issue No. {number} is live.
      </h2>
      <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
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
