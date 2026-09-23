"use server";

import { z } from "zod";
import type { WriteResult } from "@/lib/comments";
import {
  deleteComment,
  hideComment,
  unhideComment,
} from "@/server/comment-moderation";
import { INVALID } from "@/server/discussion-guard";
import { requireAdmin } from "@/server/session";

// An admin moderating from inside the thread (issue #302): the same module
// functions as the reports inbox, so hiding or deleting here resolves every
// open report on the comment too. requireAdmin() throws first — an action can
// be called directly, whatever the UI shows. No revalidatePath: the thread
// refetches its own list after each write, as the members' writes do.

const id = z.string().min(1).max(64);

async function run(
  commentId: unknown,
  write: (id: string) => Promise<WriteResult>,
): Promise<WriteResult> {
  await requireAdmin();
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  return write(parsed.data);
}

export async function hideCommentAction(commentId: unknown) {
  return run(commentId, hideComment);
}

export async function unhideCommentAction(commentId: unknown) {
  return run(commentId, unhideComment);
}

export async function moderateDeleteCommentAction(commentId: unknown) {
  return run(commentId, deleteComment);
}
