import "server-only";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";
import { env } from "@/lib/env";
import { tallyChunks, type BlastResult, type PreparedEmail } from "@/lib/blast";
import type { Branding } from "@/lib/branding";
import {
  issueEmailSubject,
  renderIssueEmailHtml,
  renderIssueEmailText,
} from "./issue-email";
import { mintMagicLink, type MagicLink } from "./magic-link";
import { listSubscribedRecipients, type Recipient } from "./recipients";
import { getSettings } from "./settings";
import { signUnsubscribeToken } from "./unsubscribe-token";

export type { BlastResult } from "@/lib/blast";

// The publish → email blast. On publish, every subscribed member gets a
// personal email whose "Read issue" button is their own magic link, minted by
// the shared helper (magic-link.ts) that also signs the reply email's button.

// Build one member's email and the DB row that backs its magic link. Returns
// the row to insert (hashed token) and the ready-to-send message (raw token in
// the URL) so the caller can bulk-insert rows, then send.
function prepare(
  recipient: Recipient,
  issueNumber: number,
  issueTitle: string,
  origin: string,
  branding: Branding,
): {
  tokenRow: MagicLink["tokenRow"];
  email: PreparedEmail;
  readUrl: string;
  unsubscribeUrl: string;
} {
  // Lands on the published issue once signed in.
  const link = mintMagicLink(recipient.email, `/read/${issueNumber}`, origin);
  const readUrl = link.url;

  // One signed token per recipient, reused for both the in-body link (the
  // interactive /unsubscribe confirm page) and the RFC 8058 one-click header
  // URL below — same authorisation, two surfaces.
  const unsubscribeToken = signUnsubscribeToken(recipient.id, "issues");
  const unsubscribeUrl = `${origin}/unsubscribe?token=${unsubscribeToken}`;

  // RFC 8058 one-click unsubscribe. Gmail/Yahoo require these on bulk mail;
  // without them the blast is more likely to be spam-filtered. The angle
  // brackets around the URL are mandatory. List-Unsubscribe-Post signals the
  // provider may POST `List-Unsubscribe=One-Click` to that URL to unsubscribe
  // the member without a round trip through the confirm page. The endpoint is
  // POST-only (see src/app/api/unsubscribe/route.ts); the query-string token is
  // the authorisation, so the POST body is not consulted.
  const oneClickUrl = `${origin}/api/unsubscribe?token=${unsubscribeToken}`;
  const listUnsubscribeHeaders: Record<string, string> = {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return {
    tokenRow: link.tokenRow,
    email: {
      to: recipient.email,
      subject: issueEmailSubject(branding.name, issueNumber, issueTitle),
      html: renderIssueEmailHtml({
        branding,
        issueTitle,
        issueNumber,
        readUrl,
        unsubscribeUrl,
      }),
      text: renderIssueEmailText({
        branding,
        issueTitle,
        issueNumber,
        readUrl,
        unsubscribeUrl,
      }),
      headers: listUnsubscribeHeaders,
    },
    readUrl,
    unsubscribeUrl,
  };
}

// Send the new-issue blast to every subscribed member. Never throws: the issue
// is published before this runs, so a mail failure must degrade to a reported
// count, not a rollback. Returns {sent, failed} for the admin to see.
export async function sendIssueBlast(
  issueNumber: number,
  issueTitle: string,
  origin: string,
): Promise<BlastResult> {
  const recipients = await listSubscribedRecipients();
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  // Resolved once for the whole blast: every member's email carries the same
  // branding, and a mid-blast settings edit must not split the run in two.
  const branding = await getSettings();
  const prepared = recipients.map((r) =>
    prepare(r, issueNumber, issueTitle, origin, branding),
  );

  // Persist every magic-link token up front (one write), so the links are live
  // the instant the emails go out. A member whose send later fails simply has
  // an unused token that expires harmlessly.
  await db.insert(verificationTokens).values(prepared.map((p) => p.tokenRow));

  const emails = prepared.map((p) => p.email);

  // Console in dev, Resend in prod. Locally there is no verified sending domain
  // (EMAIL_FROM is a placeholder), and a bulk send would just pile up bounces,
  // so dev never touches Resend: it logs each magic link in the exact
  // "[auth] magic link for <email>:" shape the sign-in email uses, which the
  // dev e2e scripts already harvest.
  if (process.env.NODE_ENV !== "production") {
    for (const { email, readUrl, unsubscribeUrl } of prepared) {
      console.log(`[auth] magic link for ${email.to}:\n[auth]   ${readUrl}`);
      // Dev-only: the sign-in email logs just the magic link; the blast also
      // logs the unsubscribe link so the whole flow is exercisable from the
      // console (the e2e script harvests this line).
      console.log(
        `[publish] unsubscribe for ${email.to}:\n[publish]   ${unsubscribeUrl}`,
      );
    }
    return { sent: prepared.length, failed: 0 };
  }

  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    // Unreachable in production — env.ts refuses to boot without email — but
    // fail loud rather than silently dropping a blast.
    throw new Error("EMAIL_API_KEY / EMAIL_FROM are not configured");
  }

  const resend = new Resend(env.EMAIL_API_KEY);
  const from = env.EMAIL_FROM;
  return tallyChunks(emails, async (batch) => {
    // Partial failures don't roll back the publish (the issue is already live),
    // so a dropped batch would otherwise vanish into the logs. Report it so the
    // developer can reconcile bounces/outages. Recipient addresses are PII and
    // are deliberately NOT attached — only the affected count and issue.
    try {
      const { error } = await resend.batch.send(
        batch.map((e) => ({ from, ...e })),
      );
      if (error) {
        console.error(`[publish] batch send failed: ${error.message}`);
        Sentry.captureMessage(`Issue blast batch failed: ${error.message}`, {
          level: "error",
          tags: { pipeline: "publish-blast", stage: "batch-send" },
          extra: { issueNumber, batchSize: batch.length },
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error("[publish] batch send threw:", err);
      Sentry.captureException(err, {
        tags: { pipeline: "publish-blast", stage: "batch-send" },
        extra: { issueNumber, batchSize: batch.length },
      });
      return false;
    }
  });
}
