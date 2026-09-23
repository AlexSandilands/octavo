"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  createIssue,
  deleteIssue,
  deleteIssues,
  getIssue,
  listMatchingIssues,
  nextIssueNumber,
  publishIssue,
  updateIssueFooterReserve,
  type DeleteIssuesResult,
  type IssueStatus,
} from "@/server/issues";
import { ISSUES_SELECTION_MAX } from "@/features/admin/selection-limit";
import { issueNumberSchema } from "@/lib/issue-number";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { sendIssueBlast, type BlastResult } from "@/server/publish-email";
import { originFromHeaders } from "@/server/site-origin";
import { requireAdmin } from "@/server/session";
import { getSettings } from "@/server/settings";
import { footerReserveOf } from "@/lib/branding";

// Mutations the admin UI calls. Server action arguments are attacker-controlled
// JSON regardless of their TypeScript types, so every argument is re-validated
// with zod here. Every action starts with requireAdmin(): the /admin layout
// and page checks only guard page navigations — an action can be invoked
// directly by any client that knows its id, so the gate lives in the action.

const idSchema = z.string().uuid();

// Returns the new issue's id; CreateIssueButton hard-navigates to it (#276,
// #296), so no revalidatePath — the dashboard is force-dynamic.
export async function createIssueAction(): Promise<string> {
  await requireAdmin();
  // The new issue's pages will be authored against the footer that is set right
  // now, so it starts with that as its reserve (issue #128).
  const settings = await getSettings();
  const issue = await createIssue(footerReserveOf(settings.footer));
  return issue.id;
}

// Bring one issue's footer up to the magazine's current setting (issue #128).
// The value comes from the settings row here, never from the caller, so this
// can only ever move an issue to the footer that is actually set.
//
// It is an explicit author action rather than something a settings save does to
// every issue at once: adopting a taller footer takes room away from pages that
// may be full, and the editor — where this is invoked from — is the one place
// that measures the canvas and marks a page whose contents no longer fit.
export async function adoptFooterAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };
  const settings = await getSettings();
  await updateIssueFooterReserve(
    parsedId.data,
    footerReserveOf(settings.footer),
  );
  revalidatePath("/admin");
  return { ok: true };
}

export type PublishResult =
  | { ok: false; reason: "invalid" | "failed" }
  /** The number was taken between the modal's proposal and the write; the
   *  modal stays open and offers `suggested` instead. */
  | { ok: false; reason: "taken"; suggested: number }
  | { ok: true; number: number; emailed: BlastResult | null };

// Publish an issue and, unless the admin skipped it, email every subscribed
// member their personal magic link to the new issue. `sendEmail` is a required
// explicit choice (the modal defaults it off for a re-publish) so a correction
// can't accidentally re-blast a thousand people.
//
// `number` is the one the admin confirmed in the modal (issue #270), consulted
// only for a draft; a number since taken comes back as "taken", not a failure.
//
// The blast runs after the publish has committed and never throws — a mail
// outage leaves the issue published and comes back as a reported failure count,
// not a rollback. We await it so the admin sees a real sent/failed tally; with
// a club-sized list (~1,000, batched 100 per Resend call) that stays quick. If
// the list ever outgrows a request, move the send to a background queue — the
// pieces here (token minting, chunked tally) port unchanged.
export async function publishIssueAction(
  id: string,
  sendEmail: boolean,
  number: unknown,
): Promise<PublishResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedSend = z.boolean().safeParse(sendEmail);
  const parsedNumber = issueNumberSchema.safeParse(number);
  if (!parsedId.success || !parsedSend.success || !parsedNumber.success) {
    return { ok: false, reason: "invalid" };
  }

  const published = await publishIssue(parsedId.data, parsedNumber.data);
  if (!published.ok) {
    return published.reason === "taken"
      ? { ok: false, reason: "taken", suggested: await nextIssueNumber() }
      : { ok: false, reason: "failed" };
  }
  revalidatePath("/admin");
  revalidatePath("/");

  if (!parsedSend.data) {
    return { ok: true, number: published.number, emailed: null };
  }

  const issue = await getIssue(parsedId.data);
  if (!issue) return { ok: false, reason: "failed" };

  // Absolute origin for the emailed links: prefer the configured canonical URL
  // (members may reach a different host than the admin did), fall back to the
  // request's own Host when APP_URL is unset (dev).
  const origin = env.APP_URL ?? originFromHeaders(await headers());
  const emailed = await sendIssueBlast(published.number, issue.title, origin);
  return { ok: true, number: published.number, emailed };
}

export async function deleteIssueAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  await deleteIssue(parsed.data);
  revalidatePath("/admin");
  return { ok: true };
}

// The dashboard's search + filters, as the two actions below re-read them.
// Attacker-typed like every other argument: a malformed filter is refused
// rather than quietly widened to "everything", which a delete would then act on.
const listOptsSchema = z.object({
  query: z.string().max(ADMIN_LIST_QUERY_MAX),
  filter: z.enum(["all", "draft", "published"]),
  year: z.number().int().min(1000).max(9999).nullable(),
});

// A selection from the dashboard, which lists every issue — so select-all is
// legitimately the whole archive, and the bound is the one the UI itself stops
// at (see features/admin/selection-limit), never a smaller one it could
// out-build. Duplicates are harmless — the data layer de-dupes.
const idsSchema = z.array(idSchema).min(1).max(ISSUES_SELECTION_MAX);

export type MatchingIssuesResult =
  | { ok: true; issues: { id: string; status: IssueStatus }[] }
  | { ok: false; reason: "invalid" };

// The bulk bar's "Select all N matching": the issues for the current search +
// filters, fetched only when the admin asks for them. A read, not a mutation —
// but still admin-gated and re-validated, because drafts are unpublished work.
export async function matchingIssuesAction(
  opts: unknown,
): Promise<MatchingIssuesResult> {
  await requireAdmin();
  const parsed = listOptsSchema.safeParse(opts);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const rows = await listMatchingIssues({
    ...parsed.data,
    limit: ISSUES_SELECTION_MAX,
  });
  return { ok: true, issues: rows };
}

export type DeleteIssuesActionResult =
  | ({ ok: true } & DeleteIssuesResult)
  | { ok: false; reason: "invalid" };

// Bulk delete from the dashboard's selection. It runs the same per-issue
// cleanup the single delete does (the two share one routine), and revalidates
// the library too: a deleted published issue must leave the members' shelf in
// the same breath.
export async function deleteIssuesAction(
  ids: unknown,
): Promise<DeleteIssuesActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await deleteIssues(parsed.data);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, ...result };
}
