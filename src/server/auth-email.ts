import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

// The magic-link email — template and transport in one file.
//
// Transport rules:
//  - Development always logs the link to the server console, so the flow is
//    testable with no Resend account at all.
//  - When EMAIL_API_KEY is set, the email is sent via Resend. A send failure
//    is fatal in production (the member is stuck otherwise) but only a
//    warning in development, where the console link still works.

type VerificationParams = { identifier: string; url: string };

export async function sendMagicLinkEmail({
  identifier,
  url,
}: VerificationParams) {
  const dev = process.env.NODE_ENV !== "production";
  if (dev) {
    console.log(`[auth] magic link for ${identifier}:\n[auth]   ${url}`);
    if (!env.EMAIL_API_KEY) return;
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    // Unreachable in production — env.ts refuses to boot without these.
    throw new Error("EMAIL_API_KEY / EMAIL_FROM are not configured");
  }

  const resend = new Resend(env.EMAIL_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: identifier,
    subject: `Sign in to ${site.name}`,
    html: renderHtml(url),
    text: renderText(url),
  });
  if (error) {
    if (dev) {
      console.warn(
        `[auth] Resend send failed (${error.message}) — use the console link above.`,
      );
      return;
    }
    throw new Error(`Failed to send sign-in email: ${error.message}`);
  }
}

// Email-client HTML: inline styles, a single centered card, one big button,
// and the raw link as a fallback for clients that strip buttons. Large type
// throughout — the audience skews older.
function renderHtml(url: string) {
  const name = escapeHtml(site.name);
  const org = escapeHtml(site.org);
  const href = escapeHtml(url);
  return `<body style="margin:0;padding:32px 16px;background:#f4f0e8;">
  <div style="max-width:480px;margin:0 auto;background:#fbf9f4;border:1px solid #e6e0d3;border-radius:16px;padding:40px 32px;font-family:Georgia,'Times New Roman',serif;color:#20201c;">
    <div style="font-size:22px;letter-spacing:.02em;">${name}</div>
    <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:#8a857b;">${org}</div>
    <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#2a2722;">
      Here is your sign-in link. Click the button below and you&rsquo;ll be
      reading in a moment &mdash; no password needed.
    </p>
    <div style="margin:28px 0;">
      <a href="${href}" style="display:block;text-align:center;background:#1d4d3e;color:#f4f0e8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;padding:16px 24px;border-radius:10px;">Sign in to ${name}</a>
    </div>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#56524a;">
      If the button doesn&rsquo;t work, copy this link into your browser:
    </p>
    <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${href}" style="color:#1d4d3e;">${href}</a>
    </p>
    <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8a857b;">
      This link works once and expires in 24 hours. If you didn&rsquo;t ask
      for it, you can safely ignore this email.
    </p>
  </div>
</body>`;
}

function renderText(url: string) {
  return [
    `Sign in to ${site.name}`,
    "",
    "Here is your sign-in link — open it and you'll be reading in a moment:",
    "",
    url,
    "",
    "This link works once and expires in 24 hours. If you didn't ask for it,",
    "you can safely ignore this email.",
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
