import "server-only";
import * as Sentry from "@sentry/nextjs";
import { count, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { Resend } from "resend";
import { db } from "@/db";
import { commentReports, issues, users } from "@/db/schema";
import { REPORT_REASON_LABELS } from "@/lib/comments";
import { env } from "@/lib/env";
import {
  renderReportEmailHtml,
  renderReportEmailText,
  reportEmailSubject,
  reportExcerpt,
  type ReportEmailParams,
} from "./report-email";
import { getSettings } from "./settings";
import { originFromHeaders } from "./site-origin";

// Tells every admin a comment was reported (issue #302). At most one email per
// 15 minutes, site-wide and in-process (the app is one long-lived node, as
// rate-limit.ts assumes): a report inside the window sends nothing, and the
// next one after it counts every open report. Dev logs the email instead.

export const REPORT_EMAIL_WINDOW_MS = 15 * 60_000;

type Message = { to: string; subject: string; html: string; text: string };

// The window and the transport, as one object so the module check can reset
// the window and stand in a failing sender.
export const reportAlert = {
  lastSentAt: null as number | null,
  send: sendMessages,
};

async function sendMessages(messages: Message[]): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    for (const m of messages) {
      console.log(
        `[report] email to ${m.to}: ${m.subject}\n${m.text.replace(/^/gm, "[report]   ")}`,
      );
    }
    return;
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    throw new Error("EMAIL_API_KEY / EMAIL_FROM are not configured");
  }
  const from = env.EMAIL_FROM;
  const { error } = await new Resend(env.EMAIL_API_KEY).batch.send(
    messages.map((m) => ({ from, ...m })),
  );
  if (error) throw new Error(`Report email failed: ${error.message}`);
}

// Where the email's inbox link points. A member's request sends it and every
// admin clicks it, so its Host header is never trusted: APP_URL, or — in
// production without it — null, and no email. Outside production the request
// host (or localhost) stands in.
export async function inboxOrigin(
  appUrl: string | undefined,
  production: boolean,
): Promise<string | null> {
  if (appUrl) return appUrl.replace(/\/$/, "");
  if (production) return null;
  try {
    return originFromHeaders(await headers());
  } catch {
    return "http://localhost:3000"; // no request in scope
  }
}

const reporter = alias(users, "reporter");

async function emailParams(
  reportId: string,
): Promise<Omit<ReportEmailParams, "branding" | "inboxUrl"> | null> {
  const [row] = await db
    .select({
      reason: commentReports.reason,
      note: commentReports.note,
      body: commentReports.snapshotBody,
      name: commentReports.snapshotName,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
      issueTitle: issues.title,
    })
    .from(commentReports)
    .innerJoin(issues, eq(issues.id, commentReports.issueId))
    .leftJoin(reporter, eq(reporter.id, commentReports.reporterId))
    .where(eq(commentReports.id, reportId));
  if (!row) return null;
  const [open] = await db
    .select({ n: count() })
    .from(commentReports)
    .where(eq(commentReports.status, "open"));
  return {
    openCount: Math.max(1, open?.n ?? 1),
    reason: REPORT_REASON_LABELS[row.reason] ?? row.reason,
    excerpt: reportExcerpt(row.body),
    note: row.note ? reportExcerpt(row.note, 300) : null,
    postedAs: reportExcerpt(row.name ?? "Former member", 80),
    reporter: reportExcerpt(
      row.reporterName?.trim() || row.reporterEmail || "A member",
      120,
    ),
    issueTitle: reportExcerpt(row.issueTitle, 120),
  };
}

/** Emails every admin about a new report, unless one went out in the last
 *  15 minutes. Throws on a failed send; the caller logs it. */
export async function notifyAdminsOfReport(reportId: string): Promise<void> {
  const now = Date.now();
  const last = reportAlert.lastSentAt;
  if (last !== null && now - last < REPORT_EMAIL_WINDOW_MS) return;
  // Claimed before any await, so two reports at once send one email.
  reportAlert.lastSentAt = now;
  try {
    const origin = await inboxOrigin(
      env.APP_URL,
      process.env.NODE_ENV === "production",
    );
    if (!origin) {
      reportAlert.lastSentAt = last;
      Sentry.captureMessage("Report email skipped: APP_URL is not set", {
        level: "error",
        tags: { stage: "report-email" },
      });
      return;
    }
    const params = await emailParams(reportId);
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.isAdmin, true));
    if (!params || admins.length === 0) return;
    const full: ReportEmailParams = {
      ...params,
      branding: await getSettings(),
      inboxUrl: `${origin}/admin/reports`,
    };
    const subject = reportEmailSubject(full);
    const html = renderReportEmailHtml(full);
    const text = renderReportEmailText(full);
    await reportAlert.send(
      admins.map((a) => ({ to: a.email, subject, html, text })),
    );
  } catch (err) {
    // A failed send gives the window back, so the next report tries again.
    reportAlert.lastSentAt = last;
    throw err;
  }
}
