import {
  FORMER_MEMBER,
  type AdminCommentView,
  type CommentDeletedBy,
  type CommentThread,
  type MemberCommentView,
  type MemberNameView,
} from "./comments";
import { memberNameKey } from "./member-name";

// The thread as it travels to the reader (issue #301): one shape for member
// and admin viewers, dates as ISO strings. Framework-free, so the route that
// builds it and the client that draws it share the one definition.

/** One comment as the thread draws it. */
export type ThreadComment = {
  id: string;
  body: string;
  name: string;
  avatarUrl: string | null;
  badge: boolean;
  isMine: boolean;
  /** A removed member's comment: "Former member", no avatar. */
  former: boolean;
  /** The page it is tagged to (#304): the page's id, never its number. */
  pageId: string | null;
  createdAt: string;
  editedAt: string | null;
  /** Admin viewers only: the club's record of the account behind the name. */
  account?: { name: string | null } | null;
  /** Admin viewers only (#302): the moderation state. A deleted comment's
   *  body is already blank. */
  hidden?: boolean;
  deleted?: boolean;
  deletedBy?: CommentDeletedBy | null;
};

export type RemovedStub = { id: string; removed: true; createdAt: string };

export type ThreadEntry = (
  | (ThreadComment & { removed: false })
  | RemovedStub
) & { replies: ThreadComment[] };

/** What the composer needs about the signed-in member. */
export type ComposerSetup = {
  names: MemberNameView[];
  /** The name on their latest comment, else their first; null with none. */
  defaultNameId: string | null;
  /** `users.name`, offered as the first posting name. */
  suggestion: string;
  /** For the browser's copy of the posting-name rules. */
  rules: { reserved: string[]; accountName: string | null };
};

export type ThreadPayload = {
  viewer: "member" | "admin";
  entries: ThreadEntry[];
  composer: ComposerSetup;
};

/** What the reader page hands its discussion control. */
export type DiscussionInfo = { issueNo: number; signedIn: boolean };

function toComment(
  view: MemberCommentView | AdminCommentView,
  admin: boolean,
): ThreadComment {
  const comment: ThreadComment = {
    id: view.id,
    body: view.body,
    name: view.name,
    avatarUrl: view.avatarUrl,
    badge: view.badge,
    isMine: view.isMine,
    // Reserved for this, so no living member can post under it.
    former: view.name === FORMER_MEMBER,
    pageId: view.pageId,
    createdAt: view.createdAt.toISOString(),
    editedAt: view.editedAt?.toISOString() ?? null,
  };
  if (admin && "account" in view) {
    comment.account = view.account && { name: view.account.name };
    comment.hidden = view.hidden;
    comment.deleted = view.deleted;
    comment.deletedBy = view.deletedBy;
  }
  return comment;
}

/** The account line an admin sees under a name (#302): shown only when the
 *  account's name differs from the posting name — a blank one always does. */
export function accountLine(
  comment: ThreadComment,
): { name: string | null } | null {
  if (!comment.account || comment.former) return null;
  const name = comment.account.name?.trim() || null;
  if (name && memberNameKey(name) === memberNameKey(comment.name)) return null;
  return { name };
}

// A member gets the members' rule, already applied by listComments: removed
// comments only as a stub, and only while they have visible replies. An admin
// gets every row, each flagged hidden / deleted (#302), removed replies too.
export function toThreadEntries(thread: CommentThread): ThreadEntry[] {
  if (thread.viewer === "member") {
    return thread.entries.map((entry) => ({
      ...(entry.removed
        ? {
            id: entry.id,
            removed: true as const,
            createdAt: entry.createdAt.toISOString(),
          }
        : { ...toComment(entry, false), removed: false as const }),
      replies: entry.replies.map((r) => toComment(r, false)),
    }));
  }
  return thread.entries.map((entry) => ({
    ...toComment(entry, true),
    removed: false as const,
    replies: entry.replies.map((r) => toComment(r, true)),
  }));
}
