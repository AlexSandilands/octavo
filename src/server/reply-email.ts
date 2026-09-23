import "server-only";
import type { Branding } from "@/lib/branding";
import { escapeAttr } from "@/lib/rich-text";

// The "someone replied to your comment" email (issue #303) — template only;
// sending lives in reply-alert.ts. Mirrors the other emails' look
// (issue-email.ts). Every member-written string — both names, both bodies, the
// issue title — goes through `escapeAttr`, so a comment holding markup arrives
// as text. The button is the member's own magic link: treat the email with the
// same care as the sign-in mail.

export type ReplyEmailParams = {
  branding: Branding;
  /** The posting names shown in the thread — never an account name or email. */
  replierName: string;
  parentName: string;
  issueNumber: number;
  issueTitle: string;
  /** The recipient's comment, briefly, and the start of the reply (~300). */
  parentExcerpt: string;
  replyExcerpt: string;
  readUrl: string;
  unsubscribeUrl: string;
};

export function replyEmailSubject(p: ReplyEmailParams): string {
  return `${p.replierName} replied to your comment on ${p.branding.name} Issue ${p.issueNumber}`;
}

export function renderReplyEmailHtml(p: ReplyEmailParams): string {
  const name = escapeAttr(p.branding.name);
  const org = escapeAttr(p.branding.org);
  const replier = escapeAttr(p.replierName);
  const href = escapeAttr(p.readUrl);
  const unsub = escapeAttr(p.unsubscribeUrl);
  const label = (text: string) =>
    `<div style="margin-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:#615c50;">${text}</div>`;
  const quote = (text: string, ink: string) =>
    `<blockquote style="margin:6px 0 0;padding:10px 14px;border-left:3px solid #e6e0d3;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${ink};">${escapeAttr(text)}</blockquote>`;
  return `<body style="margin:0;padding:32px 16px;background:#f4f0e8;">
  <div style="max-width:480px;margin:0 auto;background:#fbf9f4;border:1px solid #e6e0d3;border-radius:16px;padding:40px 32px;font-family:Georgia,'Times New Roman',serif;color:#20201c;">
    <div style="font-size:22px;letter-spacing:.02em;">${name}</div>
    <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#615c50;">${org}</div>
    <div style="margin-top:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#1d4d3e;">New reply &middot; Issue ${p.issueNumber}</div>
    <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#20201c;">${replier} replied to your comment</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#56524a;">In the discussion of &ldquo;${escapeAttr(p.issueTitle)}&rdquo;.</p>
    ${label(`${escapeAttr(p.parentName)} wrote`)}${quote(p.parentExcerpt, "#56524a")}
    ${label(`${replier} replied`)}${quote(p.replyExcerpt, "#2a2722")}
    <div style="margin:28px 0;">
      <a href="${href}" style="display:block;text-align:center;background:#1d4d3e;color:#f4f0e8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;padding:16px 24px;border-radius:10px;">Read the reply</a>
    </div>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#56524a;">
      If the button doesn&rsquo;t work, copy this link into your browser:
    </p>
    <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${href}" style="color:#1d4d3e;">${href}</a>
    </p>
    <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#615c50;">
      The button signs you in, so it&rsquo;s just for you; it works once and
      for a day. You&rsquo;re receiving this because you asked for reply
      emails on your ${name} profile.
      <a href="${unsub}" style="color:#615c50;">Stop reply emails</a>.
    </p>
  </div>
</body>`;
}

export function renderReplyEmailText(p: ReplyEmailParams): string {
  return [
    `${p.branding.name} — ${p.replierName} replied to your comment`,
    "",
    `In the discussion of "${p.issueTitle}", Issue ${p.issueNumber}.`,
    "",
    `${p.parentName} wrote:`,
    `  ${p.parentExcerpt}`,
    "",
    `${p.replierName} replied:`,
    `  ${p.replyExcerpt}`,
    "",
    "Read the reply (the link signs you in):",
    p.readUrl,
    "",
    "This link is just for you and works once, for a day.",
    "",
    `You're receiving this because you asked for reply emails on your ${p.branding.name} profile.`,
    "Stop reply emails:",
    p.unsubscribeUrl,
  ].join("\n");
}
