"use client";

import type { WriteResult } from "@/lib/comments";
import type { ThreadComment } from "@/lib/discussion-thread";
import { CommentActions } from "./comment-actions";
import { CommentEditForm } from "./comment-edit-form";
import { CommentMeta } from "./comment-meta";
import styles from "./discussion.module.css";

/** The DOM id a deep link (`?comment=`) scrolls to. */
export const commentDomId = (id: string) => `comment-${id}`;

// One comment or reply (issue #301): who and when, the words as plain text
// with their line breaks, and the action row — or the edit box in its place.
export function CommentItem({
  comment,
  now,
  viewer,
  reply,
  editing,
  onReply,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  comment: ThreadComment;
  now: number;
  viewer: "member" | "admin";
  reply: boolean;
  editing: boolean;
  onReply?: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (body: string) => Promise<WriteResult>;
  onDelete: () => Promise<WriteResult>;
}) {
  return (
    <article
      id={commentDomId(comment.id)}
      tabIndex={-1}
      aria-label={`${reply ? "Reply" : "Comment"} by ${comment.name}`}
      className={`${styles.comment} -mx-2 px-2 py-2 focus:outline-none focus-visible:outline-2`}
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
        ) : (
          <>
            <p className="text-body mt-1 font-sans text-[16px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
              {comment.body}
            </p>
            <CommentActions
              comment={comment}
              viewer={viewer}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    </article>
  );
}
