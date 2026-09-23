import "server-only";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Resend } from "resend";
import { db } from "@/db";
import {
  comments,
  issues,
  memberNames,
  users,
  verificationTokens,
} from "@/db/schema";
import { FORMER_MEMBER } from "@/lib/comments";
import { env } from "@/lib/env";
import { mintMagicLink } from "./magic-link";
import {
  renderReplyEmailHtml,
  renderReplyEmailText,
  replyEmailSubject,
  type ReplyEmailParams,
} from "./reply-email";
// The report email's excerpt rule: control characters out, whitespace folded.
import { reportExcerpt as excerpt } from "./report-email";
import { getSettings } from "./settings";
import { emailLinkOrigin } from "./site-origin";
import { signUnsubscribeToken } from "./unsubscribe-token";

// The opt-in reply email (issue #303): one per reply, to the parent comment's
// author when they turned reply emails on, never to the replier, only while
// discussion is on. Sent after the reply is committed; it never throws, so a
// mail failure can't fail the post. Dev logs the email instead of sending.
//
// Accepted: the email carries the reply's words, so a reply an admin hides
// later has already been delivered — moderation can't recall mail.

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  readUrl: string;
  unsubscribeUrl: string;
};

/** The transport, as an object so a module check can stand in for it. */
export const replyMail = { send: sendMessage };

async function sendMessage(m: Message): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    // The "[auth] magic link for" shape the sign-in and publish emails log,
    // which the dev gates harvest; the HTML on one line, so a gate can check
    // what a mail client would render.
    console.log(`[auth] magic link for ${m.to}:\n[auth]   ${m.readUrl}`);
    console.log(
      `[reply] email to ${m.to}: ${m.subject}\n${m.text.replace(/^/gm, "[reply]   ")}`,
    );
    console.log(
      `[reply] unsubscribe for ${m.to}:\n[reply]   ${m.unsubscribeUrl}`,
    );
    console.log(
      `[reply] html for ${m.to}: ${m.html.replace(/\s*\n\s*/g, " ")}`,
    );
    return;
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    throw new Error("EMAIL_API_KEY / EMAIL_FROM are not configured");
  }
  const { error } = await new Resend(env.EMAIL_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.headers,
  });
  if (error) throw new Error(`Reply email failed: ${error.message}`);
}

const parent = alias(comments, "parent");
const parentName = alias(memberNames, "parent_name");

// The reply, its parent and the parent's author — or null when no email is
// owed: not a reply, removed since, the replier's own comment, an issue with no
// number, or an author who hasn't opted in.
async function replyContext(replyId: string) {
  const [row] = await db
    .select({
      body: comments.body,
      authorId: comments.authorId,
      hiddenAt: comments.hiddenAt,
      deletedAt: comments.deletedAt,
      name: memberNames.name,
      parentBody: parent.body,
      parentAuthorId: parent.authorId,
      parentName: parentName.name,
      issueNumber: issues.number,
      issueTitle: issues.title,
      issueStatus: issues.status,
      to: users.email,
      replyEmails: users.replyEmails,
    })
    .from(comments)
    .innerJoin(parent, eq(parent.id, comments.parentId))
    .innerJoin(issues, eq(issues.id, comments.issueId))
    .innerJoin(users, eq(users.id, parent.authorId))
    .leftJoin(memberNames, eq(memberNames.id, comments.authorNameId))
    .leftJoin(parentName, eq(parentName.id, parent.authorNameId))
    .where(eq(comments.id, replyId));
  if (
    !row ||
    !row.replyEmails ||
    row.hiddenAt ||
    row.deletedAt ||
    !row.authorId ||
    row.authorId === row.parentAuthorId ||
    row.issueNumber === null ||
    row.issueStatus !== "published"
  ) {
    return null;
  }
  return { ...row, issueNumber: row.issueNumber };
}

async function prepare(replyId: string): Promise<Message | null> {
  const settings = await getSettings();
  if (!settings.commentsEnabled) return null;
  const row = await replyContext(replyId);
  if (!row || !row.parentAuthorId) return null;
  const origin = await emailLinkOrigin(
    env.APP_URL,
    process.env.NODE_ENV === "production",
  );
  if (!origin) {
    Sentry.captureMessage("Reply email skipped: APP_URL is not set", {
      level: "error",
      tags: { stage: "reply-email" },
    });
    return null;
  }

  // The #301 deep link: the thread opens on the reply, signed in.
  const link = mintMagicLink(
    row.to,
    `/read/${row.issueNumber}?discussion=1&comment=${encodeURIComponent(replyId)}`,
    origin,
  );
  await db.insert(verificationTokens).values(link.tokenRow);
  const token = signUnsubscribeToken(row.parentAuthorId, "replies");
  const unsubscribeUrl = `${origin}/unsubscribe?token=${token}`;

  const params: ReplyEmailParams = {
    branding: settings,
    replierName: excerpt(row.name ?? FORMER_MEMBER, 80),
    parentName: excerpt(row.parentName ?? FORMER_MEMBER, 80),
    issueNumber: row.issueNumber,
    issueTitle: excerpt(row.issueTitle, 120),
    parentExcerpt: excerpt(row.parentBody, 140),
    replyExcerpt: excerpt(row.body, 300),
    readUrl: link.url,
    unsubscribeUrl,
  };
  return {
    to: row.to,
    subject: replyEmailSubject(params),
    html: renderReplyEmailHtml(params),
    text: renderReplyEmailText(params),
    // RFC 8058 one-click, as the publish blast carries — a replies token, so
    // a provider's unsubscribe stops reply emails only.
    headers: {
      "List-Unsubscribe": `<${origin}/api/unsubscribe?token=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    readUrl: link.url,
    unsubscribeUrl,
  };
}

/** Emails the parent's author about a committed reply, if they opted in.
 *  Never throws: a failure is logged and reported, and the post stands. */
export async function sendReplyEmail(replyId: string): Promise<void> {
  try {
    const message = await prepare(replyId);
    if (message) await replyMail.send(message);
  } catch (err) {
    console.error("[reply] email failed", err);
    Sentry.captureException(err, { tags: { stage: "reply-email" } });
  }
}
