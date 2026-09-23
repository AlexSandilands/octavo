"use server";

import { z } from "zod";
import {
  COMMENT_BODY_MAX,
  REPORT_NOTE_MAX,
  type WriteResult,
} from "@/lib/comments";
import { createReport } from "@/server/comment-moderation";
import {
  createComment,
  deleteOwnComment,
  editComment,
} from "@/server/comments";
import { INVALID, cleanText, discussionOff } from "@/server/discussion-guard";
import { publishedIssueId } from "@/server/discussion-thread";
import { memberNameKey } from "@/lib/member-name";
import { addName, getMemberIdentity } from "@/server/member-names";
import { getUserFailClosed } from "@/server/session";

// The reader's discussion writes (issue #301). Arguments are attacker-typed
// JSON, so each is parsed here; *who* always comes from the session, inside
// the module functions. Every refusal is a sentence the thread shows as is.
// No revalidatePath: the reader and library render per request, and the
// thread refetches its own list after each write.

const id = z.string().min(1).max(64);
const bodyText = z.string().max(COMMENT_BODY_MAX * 2);

const postInput = z
  .object({
    issueNo: z.number().int().positive().max(1_000_000),
    parentId: id.nullable(),
    body: bodyText,
    nameId: id.nullable(),
    /** A first posting name, created with the post (no names yet). */
    newName: z.string().max(200).nullable(),
    /** The open page a top-level comment is tagged to (#304). Optional, so
     *  a page loaded before tags still posts. */
    pageId: id.nullish(),
  })
  .strict()
  .refine((input) => !(input.parentId && input.pageId), {
    message: "Replies are not tagged to a page.",
  });

// Signed out (an expired session) or switched off, as a sentence.
async function gate(): Promise<{ ok: false; reason: string } | null> {
  if (!(await getUserFailClosed())) {
    return {
      ok: false,
      reason: "Please sign in again to join the discussion.",
    };
  }
  return discussionOff();
}

export async function postCommentAction(
  input: unknown,
): Promise<WriteResult<{ id: string }>> {
  const refused = await gate();
  if (refused) return refused;
  const parsed = postInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const { issueNo, parentId, body, newName, pageId } = parsed.data;
  if (cleanText(body) === "") {
    return { ok: false, reason: "Write something first." };
  }
  const issueId = await publishedIssueId(issueNo);
  if (!issueId) {
    return { ok: false, reason: "Comments open once an issue is published." };
  }

  let nameId = parsed.data.nameId;
  if (!nameId) {
    // Only the very first post may bring its own name; anyone with names
    // picks one of them. A name they already hold is simply used — a first
    // post that was refused after creating it is sent again that way.
    const user = (await getUserFailClosed())!;
    const { names } = await getMemberIdentity(user.id);
    const held =
      newName === null
        ? undefined
        : names.find((n) => memberNameKey(n.name) === memberNameKey(newName));
    if (held) {
      nameId = held.id;
    } else if (names.length > 0 || newName === null) {
      return { ok: false, reason: "Choose one of your names to post under." };
    } else {
      const added = await addName({ name: newName });
      if (!added.ok) return added;
      nameId = added.name.id;
    }
  }
  return createComment({ issueId, parentId, body, nameId, pageId });
}

export async function editCommentAction(
  commentId: unknown,
  body: unknown,
): Promise<WriteResult> {
  const refused = await gate();
  if (refused) return refused;
  const parsed = z
    .object({ commentId: id, body: bodyText })
    .safeParse({ commentId, body });
  if (!parsed.success) return INVALID;
  if (cleanText(parsed.data.body) === "") {
    return { ok: false, reason: "Write something first, or delete it." };
  }
  return editComment(parsed.data);
}

export async function deleteCommentAction(
  commentId: unknown,
): Promise<WriteResult> {
  const refused = await gate();
  if (refused) return refused;
  const parsed = id.safeParse(commentId);
  if (!parsed.success) return INVALID;
  return deleteOwnComment(parsed.data);
}

// A report never fails visibly (epic #298): whatever happened — a duplicate,
// a spent budget, discussion switched off — the reporter is thanked.
export async function reportCommentAction(
  input: unknown,
): Promise<{ ok: true }> {
  const parsed = z
    .object({
      commentId: id,
      reason: z.string().max(20),
      note: z
        .string()
        .max(REPORT_NOTE_MAX * 2)
        .nullable(),
    })
    .strict()
    .safeParse(input);
  if (parsed.success && (await getUserFailClosed())) {
    try {
      await createReport(parsed.data);
    } catch (err) {
      console.error("[report] failed", err);
    }
  }
  return { ok: true };
}
