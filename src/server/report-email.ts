import "server-only";
import type { Branding } from "@/lib/branding";
import { escapeAttr } from "@/lib/rich-text";

// The "a comment was reported" email to admins (issue #302) — template only;
// the transport and the throttle live in report-alert.ts. Mirrors the other
// emails' look (issue-email.ts). Every member-written string is passed
// through `escapeAttr`, so a comment holding markup arrives as text.

export type ReportEmailParams = {
  branding: Branding;
  /** Open reports now, this one included. Above one, the email says so. */
  openCount: number;
  reason: string;
  excerpt: string;
  note: string | null;
  postedAs: string;
  reporter: string;
  issueTitle: string;
  inboxUrl: string;
};

const EXCERPT_CHARS = 200;

// Control characters out, whitespace (newlines included) folded to one space,
// then cut to ~200 characters on a code-point boundary.
export function reportExcerpt(value: string, max = EXCERPT_CHARS): string {
  const flat = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...flat];
  return chars.length > max
    ? `${chars.slice(0, max).join("").trimEnd()}…`
    : flat;
}

export function reportEmailSubject(p: ReportEmailParams): string {
  return p.openCount > 1
    ? `${p.branding.name}: ${p.openCount} open reports`
    : `${p.branding.name}: a comment has been reported`;
}

function headline(openCount: number) {
  return openCount > 1
    ? `${openCount} open reports are waiting`
    : "A comment has been reported";
}

export function renderReportEmailHtml(p: ReportEmailParams): string {
  const name = escapeAttr(p.branding.name);
  const href = escapeAttr(p.inboxUrl);
  const latest = p.openCount > 1 ? "The latest" : "The report";
  const label = (text: string) =>
    `<div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:#615c50;">${text}</div>`;
  const line = (text: string) =>
    `<p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#2a2722;">${text}</p>`;
  return `<body style="margin:0;padding:32px 16px;background:#f4f0e8;">
  <div style="max-width:480px;margin:0 auto;background:#fbf9f4;border:1px solid #e6e0d3;border-radius:16px;padding:40px 32px;font-family:Georgia,'Times New Roman',serif;color:#20201c;">
    <div style="font-size:22px;letter-spacing:.02em;">${name}</div>
    <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#615c50;">Admin</div>
    <h1 style="margin:32px 0 0;font-size:28px;line-height:1.2;color:#20201c;">${headline(p.openCount)}</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#56524a;">${latest}, on &ldquo;${escapeAttr(p.issueTitle)}&rdquo;:</p>
    ${label("Reason")}${line(escapeAttr(p.reason))}
    ${p.note ? `${label("Their note")}${line(escapeAttr(p.note))}` : ""}
    ${label(`The comment, by ${escapeAttr(p.postedAs)}`)}
    <blockquote style="margin:6px 0 0;padding:10px 14px;border-left:3px solid #e6e0d3;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#2a2722;white-space:pre-wrap;">${escapeAttr(p.excerpt)}</blockquote>
    ${label("Reported by")}${line(escapeAttr(p.reporter))}
    <div style="margin:28px 0 0;">
      <a href="${href}" style="display:block;text-align:center;background:#1d4d3e;color:#f4f0e8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;padding:16px 24px;border-radius:10px;">Open the reports inbox</a>
    </div>
    <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#615c50;">
      You&rsquo;re receiving this because you&rsquo;re an admin of ${name}.
      At most one of these is sent every 15 minutes; the inbox always has them all.
    </p>
  </div>
</body>`;
}

export function renderReportEmailText(p: ReportEmailParams): string {
  return [
    `${p.branding.name} — ${headline(p.openCount)}`,
    "",
    `${p.openCount > 1 ? "The latest" : "The report"}, on "${p.issueTitle}":`,
    `Reason: ${p.reason}`,
    ...(p.note ? [`Their note: ${p.note}`] : []),
    `The comment, by ${p.postedAs}:`,
    `  ${p.excerpt}`,
    `Reported by: ${p.reporter}`,
    "",
    "Open the reports inbox:",
    p.inboxUrl,
    "",
    "At most one of these is sent every 15 minutes; the inbox always has them all.",
  ].join("\n");
}
