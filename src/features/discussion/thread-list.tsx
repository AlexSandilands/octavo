"use client";

import type { WriteResult } from "@/lib/comments";
import type {
  ComposerSetup,
  ThreadComment,
  ThreadEntry,
} from "@/lib/discussion-thread";
import { CommentComposer, type Submit } from "./comment-composer";
import { CommentItem } from "./comment-item";

/** What the list asks of the thread that owns the state. */
export type ThreadHandlers = {
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyDraft: string;
  setReplyDraft: (value: string) => void;
  /** Closes the reply box and puts focus back on its comment. */
  cancelReply: (parentId: string) => void;
  editing: string | null;
  setEditing: (id: string | null) => void;
  cancelEdit: (commentId: string) => void;
  nameId: string | null;
  setNameId: (id: string) => void;
  reply: (parentId: string) => Submit;
  save: (commentId: string) => (body: string) => Promise<WriteResult>;
  remove: (commentId: string) => () => Promise<WriteResult>;
};

// Top-level comments oldest first, each with its replies indented once under
// it (issue #301). A removed comment with replies reads "Comment removed" so
// they still make sense; members can't tell hidden from deleted.
export function ThreadList({
  entries,
  viewer,
  setup,
  now,
  h,
}: {
  entries: ThreadEntry[];
  viewer: "member" | "admin";
  setup: ComposerSetup;
  now: number;
  h: ThreadHandlers;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted py-10 text-center font-sans text-[16px]">
        No comments yet. Start the discussion below.
      </p>
    );
  }

  const item = (comment: ThreadComment, reply: boolean) => (
    <CommentItem
      comment={comment}
      now={now}
      viewer={viewer}
      reply={reply}
      editing={h.editing === comment.id}
      onReply={
        reply
          ? undefined
          : () => {
              h.setEditing(null);
              h.setReplyTo(comment.id);
            }
      }
      onEdit={() => {
        h.setReplyTo(null);
        h.setEditing(comment.id);
      }}
      onCancelEdit={() => h.cancelEdit(comment.id)}
      onSaveEdit={h.save(comment.id)}
      onDelete={h.remove(comment.id)}
    />
  );

  return (
    <ol aria-label="Comments" className="flex flex-col gap-4">
      {entries.map((entry) => {
        const replying = !entry.removed && h.replyTo === entry.id;
        return (
          <li key={entry.id}>
            {entry.removed ? (
              <p className="text-faint py-2 font-sans text-[15px] italic">
                Comment removed
              </p>
            ) : (
              item(entry, false)
            )}
            {(entry.replies.length > 0 || replying) && (
              <ol
                aria-label={
                  entry.removed ? "Replies" : `Replies to ${entry.name}`
                }
                className="border-line mt-1 ml-[17px] flex flex-col gap-2 border-l-2 pl-3"
              >
                {entry.replies.map((r) => (
                  <li key={r.id}>{item(r, true)}</li>
                ))}
                {replying && (
                  <li className="py-2">
                    <CommentComposer
                      id={`reply-${entry.id}`}
                      label={`Reply to ${entry.name}`}
                      value={h.replyDraft}
                      onChange={h.setReplyDraft}
                      setup={setup}
                      nameId={h.nameId}
                      onNameChange={h.setNameId}
                      onSubmit={h.reply(entry.id)}
                      onCancel={() => h.cancelReply(entry.id)}
                      autoFocus
                    />
                  </li>
                )}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
}
