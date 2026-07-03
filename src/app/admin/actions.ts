"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureCoverFirst, issueContentSchema } from "@/lib/blocks";
import {
  createIssue,
  deleteIssue,
  publishIssue,
  updateIssueContent,
  updateIssueMeta,
} from "@/server/issues";
import { requireAdmin } from "@/server/session";

// Mutations the admin UI calls. Server action arguments are attacker-controlled
// JSON regardless of their TypeScript types, so every argument is re-validated
// with zod here. Every action starts with requireAdmin(): the /admin layout
// and page checks only guard page navigations — an action can be invoked
// directly by any client that knows its id, so the gate lives in the action.

const idSchema = z.string().uuid();

// .strict() so unexpected keys are rejected, not silently written to columns.
const metaSchema = z
  .object({
    title: z.string().max(200).optional(),
    theme: z.enum(["classic", "modern"]).optional(),
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

export async function publishIssueAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  await publishIssue(parsed.data);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteIssueAction(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };
  await deleteIssue(parsed.data);
  revalidatePath("/admin");
  return { ok: true };
}
