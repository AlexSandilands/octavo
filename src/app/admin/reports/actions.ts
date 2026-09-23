"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WriteResult } from "@/lib/comments";
import {
  deleteComment,
  hideComment,
  resolveReport,
  unhideComment,
} from "@/server/comment-moderation";
import { adminRetireName, clearAvatar } from "@/server/member-name-moderation";
import { requireAdmin } from "@/server/session";

// The reports inbox's row actions (issue #302). Arguments are attacker-typed
// whatever TypeScript says, so each is parsed here, and each starts with
// requireAdmin() — an action can be called directly, bypassing the page gate.
// The module functions check again and answer { ok, reason }.

const idSchema = z.string().min(1).max(64);

async function run(
  value: unknown,
  write: (id: string) => Promise<WriteResult>,
): Promise<WriteResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, reason: "Something went wrong. Please try again." };
  }
  const result = await write(parsed.data);
  // The inbox, the nav's open count and the Issues page's summary line.
  revalidatePath("/admin", "layout");
  return result;
}

export async function hideReportedCommentAction(commentId: unknown) {
  return run(commentId, hideComment);
}

export async function unhideReportedCommentAction(commentId: unknown) {
  return run(commentId, unhideComment);
}

export async function deleteReportedCommentAction(commentId: unknown) {
  return run(commentId, deleteComment);
}

export async function resolveReportAction(reportId: unknown) {
  return run(reportId, resolveReport);
}

export async function clearNameAvatarAction(nameId: unknown) {
  return run(nameId, clearAvatar);
}

export async function retireNameAction(nameId: unknown) {
  return run(nameId, adminRetireName);
}
