"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureCoverFirst, issueContentSchema } from "@/lib/blocks";
import {
  THEME_IDS,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { env } from "@/lib/env";
import {
  createIssue,
  deleteIssue,
  getIssue,
  publishIssue,
  updateIssueContent,
  updateIssueMeta,
} from "@/server/issues";
import { sendIssueBlast, type BlastResult } from "@/server/publish-email";
import { requireAdmin } from "@/server/session";

// Mutations the admin UI calls. Server action arguments are attacker-controlled
// JSON regardless of their TypeScript types, so every argument is re-validated
// with zod here. Every action starts with requireAdmin(): the /admin layout
// and page checks only guard page navigations — an action can be invoked
// directly by any client that knows its id, so the gate lives in the action.

const idSchema = z.string().uuid();

// .strict() so unexpected keys are rejected, not silently written to columns.
// The theme enum is derived from the layout-theme registry (issue #40) — one
// source of truth, so adding a theme needs no edit here. Any *known* theme is
// accepted (not just the deployment-enabled subset), so a re-save never rejects
// an issue authored under a since-disabled theme.
const metaSchema = z
  .object({
    title: z.string().max(200).optional(),
    theme: z.enum(THEME_IDS as [LayoutThemeId, ...LayoutThemeId[]]).optional(),
  })
  .strict();

export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "invalid" | "conflict" | "missing" };

export async function createIssueAction() {
  await requireAdmin();
  const issue = await createIssue();
  revalidatePath("/admin");
  redirect(`/admin/issues/${issue.id}/edit`);
}

export async function saveIssueAction(
  id: string,
  content: unknown,
  baseRevision: number,
): Promise<SaveResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedRevision = z.number().int().min(0).safeParse(baseRevision);
  const parsedContent = issueContentSchema.safeParse(content);
  if (!parsedId.success || !parsedRevision.success || !parsedContent.success) {
    return { ok: false, reason: "invalid" };
  }
  // Re-apply the cover-first invariant server-side; the editor enforces it in
  // the UI but the document must hold it regardless of the caller.
  const doc = {
    ...parsedContent.data,
    pages: ensureCoverFirst(parsedContent.data.pages),
  };
  return updateIssueContent(parsedId.data, doc, parsedRevision.data);
}

export async function saveMetaAction(
  id: string,
  meta: { title?: string; theme?: string },
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedMeta = metaSchema.safeParse(meta);
  if (!parsedId.success || !parsedMeta.success) return { ok: false };
  await updateIssueMeta(parsedId.data, parsedMeta.data);
  revalidatePath("/admin");
  return { ok: true };
}

export type PublishResult =
  | { ok: false }
  | { ok: true; emailed: BlastResult | null };

// Publish an issue and, unless the admin skipped it, email every subscribed
// member their personal magic link to the new issue. `sendEmail` is a required
// explicit choice (the modal defaults it off for a re-publish) so a correction
// can't accidentally re-blast a thousand people.
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
): Promise<PublishResult> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedSend = z.boolean().safeParse(sendEmail);
  if (!parsedId.success || !parsedSend.success) return { ok: false };

  await publishIssue(parsedId.data);
  revalidatePath("/admin");
  revalidatePath("/");

  if (!parsedSend.data) return { ok: true, emailed: null };

  const issue = await getIssue(parsedId.data);
  if (!issue) return { ok: false };

  // Absolute origin for the emailed links: prefer the configured canonical URL
  // (members may reach a different host than the admin did), fall back to the
  // request's own Host when APP_URL is unset (dev).
  const origin = env.APP_URL ?? originFromHeaders(await headers());
  const emailed = await sendIssueBlast(issue.number, issue.title, origin);
  return { ok: true, emailed };
}

function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function deleteIssueAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  await deleteIssue(parsed.data);
  revalidatePath("/admin");
  return { ok: true };
}
