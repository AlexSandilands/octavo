import "server-only";
import { createHash, randomBytes } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";
import { env } from "@/lib/env";
import { tallyChunks, type BlastResult, type PreparedEmail } from "@/lib/blast";
import { safeNextPath } from "@/lib/next-path";
import {
  issueEmailSubject,
  renderIssueEmailHtml,
  renderIssueEmailText,
} from "./issue-email";
import { listSubscribedRecipients, type Recipient } from "./recipients";
import { signUnsubscribeToken } from "./unsubscribe-token";

export type { BlastResult } from "@/lib/blast";

// The publish → email blast. On publish, every subscribed member gets a
// personal email whose "Read issue" button is their own magic link.
//
// Security: the magic link is a single-use sign-in credential and MUST be
// produced by the exact mechanism Auth.js uses for the sign-in email, or the
// callback route won't accept it. Auth.js's email flow (see
// @auth/core/lib/actions/signin/send-token.js) is:
//   1. token   = randomString(32)                     — the raw value in the URL
//   2. stored  = sha256hex(`${token}${secret}`)       — what lands in the DB
//   3. url     = `${origin}/api/auth/callback/resend?callbackUrl=…&token=<raw>&email=<id>`
// On click, the callback recomputes sha256hex(`${rawToken}${secret}`) and calls
// the adapter's useVerificationToken, which deletes the row as it reads it —
// that delete-on-read is what makes the link single-use. We replicate exactly
// that here, with the SAME secret the callback uses (`provider.secret ??
// options.secret`, which for our config is env.AUTH_SECRET — see auth.ts), so
// our links are indistinguishable from ones Auth.js minted.
//
// Coupling note: if the deployment ever moves to AUTH_SECRET rotation (an
// array of secrets), revisit this — the callback would hash against the array
// and these links would need to match.

// Match the Resend provider's maxAge (24h) so a blast link is no longer-lived
// than a sign-in link. If it lapses before a member opens it, they aren't
// stuck: the reader gate sends them to /signin, they request a fresh link, and
// land back on the issue — one extra tap, no dead end.
const MAGIC_LINK_MAX_AGE_SECONDS = 24 * 60 * 60;

// Auth.js's createHash is web-crypto SHA-256 hex; node's createHash produces
// the identical digest for the same input.
function hashVerificationToken(rawToken: string): string {
  return createHash("sha256")
    .update(`${rawToken}${env.AUTH_SECRET}`)
    .digest("hex");
}

// Build one member's email and the DB row that backs its magic link. Returns
// the row to insert (hashed token) and the ready-to-send message (raw token in
// the URL) so the caller can bulk-insert rows, then send.
function prepare(
  recipient: Recipient,
  issueNumber: number,
  issueTitle: string,
  origin: string,
): {
  tokenRow: { identifier: string; token: string; expires: Date };
  email: PreparedEmail;
  readUrl: string;
  unsubscribeUrl: string;
} {
  const rawToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAGIC_LINK_MAX_AGE_SECONDS * 1000);

  // Where the link lands after sign-in. Fixed to the published issue and run
  // through the same same-origin guard the sign-in ?next uses — belt-and-braces
  // against ever emitting an off-site callbackUrl.
  const readPath = safeNextPath(`/read/${issueNumber}`);
  const params = new URLSearchParams({
    callbackUrl: readPath,
    token: rawToken,
    email: recipient.email,
  });
  const readUrl = `${origin}/api/auth/callback/resend?${params}`;

  const unsubscribeUrl = `${origin}/unsubscribe?token=${signUnsubscribeToken(
    recipient.id,
  )}`;

  return {
    tokenRow: {
      identifier: recipient.email,
      token: hashVerificationToken(rawToken),
      expires,
    },
    email: {
      to: recipient.email,
      subject: issueEmailSubject(issueNumber, issueTitle),
      html: renderIssueEmailHtml({
        issueTitle,
        issueNumber,
        readUrl,
        unsubscribeUrl,
      }),
      text: renderIssueEmailText({
        issueTitle,
        issueNumber,
        readUrl,
        unsubscribeUrl,
      }),
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

  const prepared = recipients.map((r) =>
    prepare(r, issueNumber, issueTitle, origin),
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
