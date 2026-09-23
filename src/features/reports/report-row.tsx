"use client";

import Link from "next/link";
import { useId } from "react";
import { Pill } from "@/components/ui";
import {
  FORMER_MEMBER,
  type ReportReason,
  type ReportView,
} from "@/lib/comments";
import { ClampedText } from "./clamped-text";
import { ReportActions } from "./report-actions";

const HEADINGS: Record<ReportReason, string> = {
  harassment: "Reported as harassment",
  offensive: "Reported as offensive",
  spam: "Reported as spam",
  other: "Reported for another reason",
};

const formatWhen = (d: Date) =>
  new Date(d).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function When({ at }: { at: Date }) {
  // The server and the browser may sit in different time zones.
  return (
    <time dateTime={new Date(at).toISOString()} suppressHydrationWarning>
      {formatWhen(at)}
    </time>
  );
}

// Where the issue link lands: the comment in the discussion (#301's deep
// link) while it exists, else the issue itself.
function issueHref(report: ReportView): string | null {
  if (report.issue.number === null) return null;
  const base = `/read/${report.issue.number}`;
  return report.current.state === "deleted"
    ? base
    : `${base}?discussion=1&comment=${encodeURIComponent(report.current.commentId)}`;
}

// One report: the comment as it was reported, what has become of it since,
// the issue, the reason and note, the reporter and when, then the actions.
export function ReportRow({
  report,
  onDone,
}: {
  report: ReportView;
  onDone: (outcome: string) => void;
}) {
  const headingId = useId();
  const { snapshot, current } = report;
  const postedAs = snapshot.name ?? FORMER_MEMBER;
  const account = snapshot.account;
  const href = issueHref(report);
  const reporter = report.reporter;

  return (
    <article
      aria-labelledby={headingId}
      className="border-line-soft border-b py-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id={headingId}
          className="text-ink font-sans text-[16px] font-semibold"
        >
          {HEADINGS[report.reason]}
        </h2>
        <Pill status={report.status === "open" ? "Open" : "Resolved"} />
        <span className="text-faint font-sans text-[13px]">
          <When at={report.createdAt} />
        </span>
      </div>

      <figure className="border-hair mt-3 rounded-lg border-[1.5px] bg-white px-4 pt-3 pb-2">
        <figcaption className="text-faint font-sans text-[13px]">
          <span className="text-ink font-semibold">{postedAs}</span>
          {account ? (
            <>
              {" · Account: "}
              <Link
                href={`/admin/members?q=${encodeURIComponent(account.email)}`}
                className="text-accent font-medium hover:underline"
              >
                {account.name ?? account.email}
              </Link>
            </>
          ) : (
            <> · Account removed</>
          )}
          <span className="text-faint2"> · as reported</span>
        </figcaption>
        <ClampedText text={snapshot.body} className="mt-1.5" />
      </figure>

      <CurrentState current={current} />

      <dl className="mt-3 grid gap-x-4 gap-y-1.5 font-sans text-[14px] sm:grid-cols-[auto_1fr]">
        <dt className="text-faint">Issue</dt>
        <dd className="text-body min-w-0">
          {href ? (
            <Link
              href={href}
              className="text-accent font-medium hover:underline"
            >
              No. {report.issue.number} · {report.issue.title}
            </Link>
          ) : (
            <>{report.issue.title} (not published)</>
          )}
        </dd>
        {report.note && (
          <>
            <dt className="text-faint">Their note</dt>
            <dd className="text-body min-w-0 break-words whitespace-pre-wrap">
              {report.note}
            </dd>
          </>
        )}
        <dt className="text-faint">Reported by</dt>
        <dd className="text-body min-w-0 break-words">
          {reporter
            ? `${reporter.name ?? reporter.email}${reporter.name ? ` (${reporter.email})` : ""}`
            : "A member who has since been removed"}
        </dd>
        {report.status === "resolved" && report.resolvedAt && (
          <>
            <dt className="text-faint">Resolved</dt>
            <dd className="text-body min-w-0">
              <When at={report.resolvedAt} />
              {report.resolvedBy &&
                ` by ${report.resolvedBy.name ?? "an admin"}`}
            </dd>
          </>
        )}
      </dl>

      <ReportActions report={report} onDone={onDone} />
    </article>
  );
}

function CurrentState({ current }: { current: ReportView["current"] }) {
  const note = "text-warn mt-2.5 font-sans text-[14px] font-semibold";
  if (current.state === "deleted") {
    return (
      <p className={note}>
        {current.by === "admin"
          ? "Removed by an admin since"
          : "Deleted by its author since"}
      </p>
    );
  }
  return (
    <>
      {current.hidden && <p className={note}>Removed by an admin since</p>}
      {current.state === "edited" && (
        <div className="mt-2.5">
          <p className="text-warn font-sans text-[14px] font-semibold">
            Edited since:
          </p>
          <ClampedText
            text={current.body}
            className="border-line-soft mt-1 border-l-2 pl-3"
          />
        </div>
      )}
    </>
  );
}
