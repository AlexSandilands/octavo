// The discussion's shared vocabulary (issue #299): limits, report reasons and
// the read shapes the server hands to pages. Framework-free, so client
// components (#300–#304) can import it without pulling in `db`.

export const COMMENT_BODY_MAX = 2000;
export const REPORT_NOTE_MAX = 500;
/** Unretired posting names one account may hold. */
export const MAX_ACTIVE_NAMES = 5;
/** Notifications kept per member; older ones are trimmed on insert. */
export const MAX_NOTIFICATIONS = 100;

/** What a comment by a removed member is shown as. */
export const FORMER_MEMBER = "Former member";

export const REPORT_REASONS = [
  "harassment",
  "offensive",
  "spam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Who soft-deleted a comment: its author, or an admin (a moderation delete,
 *  or a removal under the "delete" policy). */
export const COMMENT_DELETED_BY = ["author", "admin"] as const;
export type CommentDeletedBy = (typeof COMMENT_DELETED_BY)[number];

export const REPORT_STATUSES = ["open", "resolved"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** A module write's answer: ok, or a sentence a member can read. */
export type WriteResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

/** One of the viewer's own posting names. */
export type MemberNameView = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Stored flag; it renders only while the account is an admin. */
  badge: boolean;
};

/** A comment as a member sees it. Deliberately no email and no author id —
 *  `isMine` is decided on the server. */
export type MemberCommentView = {
  id: string;
  removed: false;
  body: string;
  name: string;
  avatarUrl: string | null;
  badge: boolean;
  isMine: boolean;
  pageId: string | null;
  createdAt: Date;
  editedAt: Date | null;
};

/** A hidden or deleted top-level comment kept for its replies. A member can't
 *  tell which of the two it was. */
export type RemovedCommentStub = {
  id: string;
  removed: true;
  createdAt: Date;
};

export type MemberThreadEntry = (MemberCommentView | RemovedCommentStub) & {
  replies: MemberCommentView[];
};

/** The admin's view adds the moderation state and the account behind the name
 *  (the club's record of it, never the email). */
export type AdminCommentView = Omit<MemberCommentView, "removed"> & {
  removed: boolean;
  hidden: boolean;
  deleted: boolean;
  account: { id: string; name: string | null } | null;
};

export type AdminThreadEntry = AdminCommentView & {
  replies: AdminCommentView[];
};

export type CommentThread =
  | { viewer: "member"; entries: MemberThreadEntry[] }
  | { viewer: "admin"; entries: AdminThreadEntry[] };

// Type-level guarantee that neither member shape can carry who wrote it: adding
// either field fails the build here.
type Forbidden = "email" | "authorId" | "userId" | "account";
type Assert<T extends true> = T;
export type MemberShapeIsAnonymous = Assert<
  Extract<
    keyof MemberCommentView | keyof RemovedCommentStub,
    Forbidden
  > extends never
    ? true
    : false
>;

export type NotificationView = {
  id: string;
  commentId: string;
  issueNumber: number | null;
  issueTitle: string;
  replierName: string;
  /** The posting name the replied-to comment went under — a shared account's
   *  bell says whose comment it was. */
  parentName: string;
  excerpt: string;
  createdAt: Date;
  read: boolean;
};

export type ReportView = {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: { id: string; name: string | null } | null;
  issue: { id: string; number: number | null; title: string };
  reporter: { id: string; name: string | null; email: string } | null;
  snapshot: {
    body: string;
    name: string | null;
    account: { id: string; name: string | null; email: string } | null;
    createdAt: Date | null;
    editedAt: Date | null;
  };
  /** The comment now, against the snapshot: the inbox's "edited since", or
   *  who deleted it (`comments.deleted_by`). */
  current:
    | {
        state: "unchanged" | "edited";
        commentId: string;
        body: string;
        hidden: boolean;
      }
    | { state: "deleted"; by: "author" | "admin" };
  /** The posting name the comment is under now, for Clear avatar and Retire
   *  name; null once the comment or its name is gone. */
  name: {
    id: string;
    name: string;
    avatarUrl: string | null;
    retired: boolean;
  } | null;
};

export const REPORT_FILTERS = ["open", "resolved", "all"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment",
  offensive: "Offensive",
  spam: "Spam",
  other: "Other",
};
