"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { issueContentSchema } from "@/lib/blocks";
import {
  createIssue,
  deleteIssue,
  publishIssue,
  updateIssueContent,
  updateIssueMeta,
} from "@/server/issues";

// Mutations the admin UI calls. Inputs are validated here so adding auth later
// is just a gate, not a rewrite (see docs/design-principles.md §9).

export async function createIssueAction() {
  const issue = await createIssue();
  revalidatePath("/admin");
  redirect(`/admin/issues/${issue.id}/edit`);
}

export async function saveIssueAction(id: string, content: unknown) {
  const parsed = issueContentSchema.parse(content);
  await updateIssueContent(id, parsed);
}

export async function saveMetaAction(
  id: string,
  meta: { title?: string; theme?: string },
) {
  await updateIssueMeta(id, meta);
  revalidatePath("/admin");
}

export async function publishIssueAction(id: string) {
  await publishIssue(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteIssueAction(id: string) {
  await deleteIssue(id);
  revalidatePath("/admin");
}
