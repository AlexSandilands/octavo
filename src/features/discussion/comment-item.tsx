"use client";

import type { WriteResult } from "@/lib/comments";
import type { ThreadComment } from "@/lib/discussion-thread";
import { CommentActions } from "./comment-actions";
import { CommentEditForm } from "./comment-edit-form";
import { CommentMeta } from "./comment-meta";
import styles from "./discussion.module.css";
import type { Moderate } from "./moderation-buttons";

/** The DOM id a deep link (`?comment=`) scrolls to. */
export const commentDomId = (id: string) => `comment-${id}`;

// One comment or reply (issue #301): who and when, the words as plain text
// with their line breaks, and the action row — or the edit box in its place.
// Admins also get the removed ones (#302): a hidden comment greyed with its
// words, a deleted one as a marked stub with nothing left to act on. A tagged
// comment shows its page chip above the words (#304).
export function CommentItem({
  comment,
  now,
  viewer,
  reply,
  editing,
  tag,
  onReply,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onModerate,
}: {
  comment: ThreadComment;
  now: number;
  viewer: "member" | "admin";
  reply: boolean;
  editing: boolean;
  /** The page chip, for a comment tagged to a page. */
  tag?: React.ReactNode;
  onReply?: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (body: string) => Promise<WriteResult>;
  onDelete: () => Promise<WriteResult>;
  onModerate: Moderate;
}) {
  const state = comment.deleted ? "deleted" : comment.hidden ? "hidden" : null;
  return (
    <article
      id={commentDomId(comment.id)}
      tabIndex={-1}
      aria-label={`${reply ? "Reply" : "Comment"} by ${comment.name}${state ? ` (${state})` : ""}`}
      data-moderation={state ?? undefined}
      className={`${styles.comment} -mx-2 px-2 py-2 focus:outline-none focus-visible:outline-2 ${state === "hidden" ? "bg-chip-soft" : ""}`}
    >
      <CommentMeta comment={comment} now={now} reply={reply} />
      <div className={reply ? "pl-[38px]" : "pl-[46px]"}>
        {editing ? (
          <CommentEditForm
            id={`edit-${comment.id}`}
            initial={comment.body}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : state === "deleted" ? (
          <p className="text-muted mt-1 pb-2 font-sans text-[15px] italic">
            {comment.deletedBy === "author"
              ? "Deleted by its author."
              : "Deleted by an admin."}
          </p>
        ) : (
          <>
            {tag && <div className="mt-0.5">{tag}</div>}
            <p
              className={`${state === "hidden" ? "text-muted" : "text-body"} mt-1 font-sans text-[16px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap`}
            >
              {comment.body}
            </p>
            <CommentActions
              comment={comment}
              viewer={viewer}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onModerate={onModerate}
            />
          </>
        )}
      </div>
    </article>
  );
}
