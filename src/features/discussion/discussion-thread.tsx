"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { WriteResult } from "@/lib/comments";
import type { ThreadPayload } from "@/lib/discussion-thread";
import {
  deleteCommentAction,
  editCommentAction,
  postCommentAction,
} from "@/app/read/[issueId]/actions";
import { CommentComposer } from "./comment-composer";
import { commentDomId } from "./comment-item";
import { ThreadList, type ThreadHandlers } from "./thread-list";
import type { Discussion } from "./use-discussion";
import { MAIN_COMPOSER, useCommentTarget } from "./use-comment-target";
import { useThread } from "./use-thread";

// The thread inside either shell (issue #301): the list scrolling above, the
// composer pinned below. It owns the writes: each one refetches the list, then
// the new or changed comment is scrolled to and announced.
export function DiscussionThread({ talk }: { talk: Discussion }) {
  const { info, setCount } = talk;
  const listRef = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState({ text: "", n: 0 });
  const announce = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));
  const [nameId, setNameId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const onLoaded = useCallback(
    (payload: ThreadPayload) => setCount(payload.count),
    [setCount],
  );
  const thread = useThread(info.issueNo, onLoaded);
  const { payload } = thread;
  const aim = useCommentTarget(payload, talk.focusComment, {
    list: listRef,
    announce,
    onDeepLinkDone: talk.clearFocusComment,
  });

  const focusLater = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.focus());

  const post = async (
    parentId: string | null,
    body: string,
    newName: string | null,
  ): Promise<WriteResult> => {
    const setup = payload!.composer;
    const current =
      setup.names.find((n) => n.id === nameId)?.id ?? setup.defaultNameId;
    const result = await postCommentAction({
      issueNo: info.issueNo,
      parentId,
      body,
      nameId: newName ? null : current,
      newName,
    });
    if (!result.ok) return result;
    aim({
      id: result.id,
      focus: parentId ? "comment" : "composer",
      highlight: false,
    });
    await thread.reload();
    if (parentId) {
      setReplyTo(null);
      setReplyDraft("");
    } else {
      talk.setDraft("");
    }
    announce(parentId ? "Your reply is posted." : "Your comment is posted.");
    return result;
  };

  const h: ThreadHandlers = {
    replyTo,
    setReplyTo: (id) => {
      setReplyTo(id);
      setReplyDraft("");
    },
    replyDraft,
    setReplyDraft,
    cancelReply: (parentId) => {
      setReplyTo(null);
      setReplyDraft("");
      focusLater(commentDomId(parentId));
    },
    editing,
    setEditing,
    cancelEdit: (id) => {
      setEditing(null);
      focusLater(commentDomId(id));
    },
    nameId,
    setNameId,
    reply: (parentId) => (body, newName) => post(parentId, body, newName),
    save: (id) => async (body) => {
      const result = await editCommentAction(id, body);
      if (!result.ok) return result;
      aim({ id, focus: "comment", highlight: false });
      await thread.reload();
      setEditing(null);
      announce("Your comment is updated.");
      return result;
    },
    remove: (id) => async () => {
      const result = await deleteCommentAction(id);
      if (!result.ok) return result;
      await thread.reload();
      announce("Your comment is deleted.");
      focusLater(MAIN_COMPOSER);
      return result;
    },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="scrollbar-soft min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]"
      >
        {payload ? (
          <ThreadList
            entries={payload.entries}
            viewer={payload.viewer}
            setup={payload.composer}
            now={thread.loadedAt}
            h={h}
          />
        ) : thread.error ? (
          <div className="py-10 text-center">
            <p role="alert" className="text-muted font-sans text-[16px]">
              {thread.error}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 min-h-11"
              onClick={() => void thread.reload()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <p role="status" className="text-faint py-10 text-center font-sans">
            Loading the discussion…
          </p>
        )}
        {payload && thread.error && (
          <p role="alert" className="text-warn mt-4 font-sans text-[14px]">
            {thread.error}
          </p>
        )}
      </div>
      {payload && (
        <div className="border-line border-t px-5 pt-3 pb-4">
          <CommentComposer
            id={MAIN_COMPOSER}
            label="Add to the discussion"
            value={talk.draft}
            onChange={talk.setDraft}
            setup={payload.composer}
            nameId={nameId}
            onNameChange={setNameId}
            onSubmit={(body, newName) => post(null, body, newName)}
            menuSide="top"
          />
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {said.text}
        {said.n % 2 ? " " : ""}
      </p>
    </div>
  );
}
