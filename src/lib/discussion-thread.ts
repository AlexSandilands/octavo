import {
  FORMER_MEMBER,
  type AdminCommentView,
  type CommentThread,
  type MemberCommentView,
  type MemberNameView,
} from "./comments";

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
  createdAt: string;
  editedAt: string | null;
  /** Admin viewers only: the club's record of the account behind the name. */
  account?: { name: string | null } | null;
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
  /** Visible comments and replies — what the controls' badges show. */
  count: number;
  composer: ComposerSetup;
};

/** What the reader page hands its discussion control. */
export type DiscussionInfo = {
  issueNo: number;
  /** Null for a signed-out (demo) visitor, who is shown no count at all. */
  count: number | null;
  signedIn: boolean;
};

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
    createdAt: view.createdAt.toISOString(),
    editedAt: view.editedAt?.toISOString() ?? null,
  };
  if (admin && "account" in view) comment.account = view.account;
  return comment;
}

// The admin read carries every row; it is folded to the members' rule here
// (removed replies dropped, a removed parent kept as a stub only while it has
// visible replies) until #302 gives admins their own treatment in the thread.
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
  const entries: ThreadEntry[] = [];
  for (const entry of thread.entries) {
    const replies = entry.replies
      .filter((r) => !r.removed)
      .map((r) => toComment(r, true));
    if (!entry.removed) {
      entries.push({ ...toComment(entry, true), removed: false, replies });
    } else if (replies.length > 0) {
      const createdAt = entry.createdAt.toISOString();
      entries.push({ id: entry.id, removed: true, createdAt, replies });
    }
  }
  return entries;
}

/** Visible comments and replies, counted as `countComments` counts them. */
export function threadCount(entries: ThreadEntry[]): number {
  return entries.reduce(
    (n, entry) => n + (entry.removed ? 0 : 1) + entry.replies.length,
    0,
  );
}
