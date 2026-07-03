import "server-only";
import { escapeAttr } from "@/lib/rich-text";
import { site } from "@/lib/site";

// The new-issue announcement email — template only (the transport lives in
// publish-email.ts). Mirrors the sign-in email's look (auth-email.ts): inline
// styles, one centered card, large type for an older audience, a single big
// action button, and the raw link as a fallback for clients that strip
// buttons.
//
// The "Read issue" button IS the member's magic link — clicking it signs them
// in and lands them on the issue. The email therefore carries a sign-in
// credential and must be treated with the same care as the sign-in mail: no
// other secrets in the body, one recipient per send.

export type IssueEmailParams = {
  issueTitle: string;
  issueNumber: number;
  // The member's personal magic link (signs in + opens the issue).
  readUrl: string;
  // The member's personal signed unsubscribe link.
  unsubscribeUrl: string;
};

export function issueEmailSubject(number: number, title: string): string {
  return `${site.name} No. ${number}: ${title}`;
}

export function renderIssueEmailHtml({
  issueTitle,
  issueNumber,
  readUrl,
  unsubscribeUrl,
}: IssueEmailParams): string {
  const name = escapeAttr(site.name);
  const org = escapeAttr(site.org);
  const title = escapeAttr(issueTitle);
  const href = escapeAttr(readUrl);
  const unsub = escapeAttr(unsubscribeUrl);
  return `<body style="margin:0;padding:32px 16px;background:#f4f0e8;">
  <div style="max-width:480px;margin:0 auto;background:#fbf9f4;border:1px solid #e6e0d3;border-radius:16px;padding:40px 32px;font-family:Georgia,'Times New Roman',serif;color:#20201c;">
    <div style="font-size:22px;letter-spacing:.02em;">${name}</div>
    <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#615c50;">${org}</div>
    <div style="margin-top:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#1d4d3e;">New issue &middot; No. ${issueNumber}</div>
    <h1 style="margin:8px 0 0;font-size:30px;line-height:1.15;color:#20201c;">${title}</h1>
    <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#2a2722;">
      The latest issue is ready. Click below and you&rsquo;ll be reading in a
      moment &mdash; the link signs you in, no password needed.
    </p>
    <div style="margin:28px 0;">
      <a href="${href}" style="display:block;text-align:center;background:#1d4d3e;color:#f4f0e8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;padding:16px 24px;border-radius:10px;">Read issue No. ${issueNumber}</a>
    </div>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#56524a;">
      If the button doesn&rsquo;t work, copy this link into your browser:
    </p>
    <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${href}" style="color:#1d4d3e;">${href}</a>
    </p>
    <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#615c50;">
      This link is just for you and works once. You&rsquo;re receiving this
      because you&rsquo;re a member of ${org}.
      <a href="${unsub}" style="color:#615c50;">Unsubscribe from these emails</a>.
    </p>
  </div>
</body>`;
}

export function renderIssueEmailText({
  issueTitle,
  issueNumber,
  readUrl,
  unsubscribeUrl,
}: IssueEmailParams): string {
  return [
    `${site.name} — New issue No. ${issueNumber}: ${issueTitle}`,
    "",
    "The latest issue is ready. Open the link below and you'll be reading in a",
    "moment — it signs you in, no password needed:",
    "",
    readUrl,
    "",
    "This link is just for you and works once.",
    "",
    `You're receiving this because you're a member of ${site.org}.`,
    "Unsubscribe from these emails:",
    unsubscribeUrl,
  ].join("\n");
}
