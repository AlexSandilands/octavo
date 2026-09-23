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
import {
  hideCommentAction,
  moderateDeleteCommentAction,
  unhideCommentAction,
} from "@/app/read/[issueId]/moderation-actions";
import { COMMENT_SHOWN } from "@/lib/moderation-copy";
import { CommentComposer } from "./comment-composer";
import type { ModerationAction } from "./moderation-buttons";
import { commentDomId } from "./comment-item";
import { ThreadList, type ThreadHandlers } from "./thread-list";
import type { Discussion } from "./use-discussion";
import { MAIN_COMPOSER, useCommentTarget } from "./use-comment-target";
import { useThread } from "./use-thread";
import { PageFilter } from "./page-filter";
import { PageTagPicker, choicePage } from "./page-tag-picker";
import { pageName, type ReaderPages } from "./page-tags";

const MODERATION = {
  hide: [hideCommentAction, "Comment hidden from members."],
  unhide: [unhideCommentAction, COMMENT_SHOWN],
  delete: [moderateDeleteCommentAction, "Comment deleted."],
} as const satisfies Record<
  ModerationAction,
  readonly [(id: string) => Promise<WriteResult>, string]
>;

// The thread inside either shell (issue #301): the list scrolling above, the
// composer pinned below. It owns the writes: each one refetches the list, then
// the new or changed comment is scrolled to and announced. The reader's open
// pages (#304) feed the composer's tag, the chips and "This page only".
export function DiscussionThread({
  talk,
  pages,
}: {
  talk: Discussion;
  pages: ReaderPages;
}) {
  const { info } = talk;
  const listRef = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState({ text: "", n: 0 });
  const announce = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));
  const [nameId, setNameId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  // Replies start folded; which parents are open lives only while the shell is.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const unfold = (id: string) =>
    setUnfolded((s) => (s.has(id) ? s : new Set(s).add(id)));

  // A deep link to a reply opens its parent, in the same render as the list,
  // so the reply is there to scroll to.
  const deepLink = useRef(talk.focusComment);
  const onLoaded = useCallback((payload: ThreadPayload) => {
    const id = deepLink.current;
    deepLink.current = null;
    const parent = payload.entries.find((e) =>
      e.replies.some((r) => r.id === id),
    );
    if (parent) setUnfolded((s) => new Set(s).add(parent.id));
  }, []);
  const narrowed = talk.pagesOnly ? pages.open : null;
  const thread = useThread(info.issueNo, narrowed, onLoaded);
  const { payload } = thread;
  const shown =
    payload && thread.filter === (narrowed?.join(",") ?? "")
      ? payload.entries.filter((e) => !e.removed).length
      : null;
  const aim = useCommentTarget(payload, talk.focusComment, {
    list: listRef,
    announce,
    onDeepLinkDone: talk.clearFocusComment,
  });

  // After a confirmation, the thread stays inert until the dialog has gone, so
  // focus waits for that (a few frames at most).
  const focusLater = (...ids: string[]) => {
    let frames = 30;
    const attempt = () => {
      const el = ids
        .map((id) => document.getElementById(id))
        .find((found) => found !== null);
      if (el?.closest("[inert]") && --frames > 0) {
        requestAnimationFrame(attempt);
      } else el?.focus();
    };
    requestAnimationFrame(attempt);
  };

  const post = async (
    parentId: string | null,
    body: string,
    newName: string | null,
  ): Promise<WriteResult> => {
    const setup = payload!.composer;
    const current =
      setup.names.find((n) => n.id === nameId)?.id ?? setup.defaultNameId;
    const pageId = parentId ? null : choicePage(talk.tag);
    const result = await postCommentAction({
      issueNo: info.issueNo,
      parentId,
      body,
      nameId: newName ? null : current,
      newName,
      pageId,
    });
    if (!result.ok) {
      // A refused first post may still have created its name: reload so the
      // composer moves on to "Posting as" it, keeping the draft and the reason.
      if (newName) await thread.reload();
      return result;
    }
    aim({
      id: result.id,
      focus: parentId ? "comment" : "composer",
      highlight: false,
    });
    // A reply you have just posted stays in view under its parent; a comment
    // the filter would hide (not on the open pages) clears the filter.
    if (parentId) unfold(parentId);
    const unfilter =
      !parentId &&
      talk.pagesOnly &&
      !(pageId !== null && pages.open.includes(pageId));
    if (unfilter) talk.setPagesOnly(false);
    await thread.reload(unfilter ? null : undefined);
    if (parentId) {
      setReplyTo(null);
      setReplyDraft("");
    } else {
      talk.setDraft("");
      talk.setTag(null);
    }
    announce(
      parentId
        ? "Your reply is posted."
        : unfilter
          ? "Your comment is posted. Showing every comment."
          : "Your comment is posted.",
    );
    return result;
  };

  // Desktop turns the flipbook behind the drawer, which stays open; on a
  // phone the sheet closes and the column scrolls there.
  const goToPage = (pageId: string) => {
    pages.go(pageId);
    const name = pageName(pages, pageId);
    if (name) announce(`Now showing ${name}.`);
  };

  const h: ThreadHandlers = {
    isUnfolded: (id) => unfolded.has(id) || replyTo === id,
    // Folding away an open reply box closes it too.
    toggleReplies: (id) => {
      const open = unfolded.has(id) || replyTo === id;
      if (open && replyTo === id) {
        setReplyTo(null);
        setReplyDraft("");
      }
      setUnfolded((s) => {
        const next = new Set(s);
        if (open) next.delete(id);
        else next.add(id);
        return next;
      });
    },
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
    pages,
    goToPage,
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
    // Hide and Unhide keep focus on the button they flip; a delete lands on
    // the stub it leaves, or back in the box when nothing is left.
    moderate: (id) => async (action) => {
      const [write, done] = MODERATION[action];
      const result = await write(id);
      if (!result.ok) return result;
      await thread.reload();
      announce(done);
      if (action === "delete") focusLater(commentDomId(id), MAIN_COMPOSER);
      return result;
    },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="scrollbar-soft min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]"
      >
        {/* Heads the list and scrolls with it, so a short sheet with the
            keyboard up spends its height on the box. */}
        {pages.open.length > 0 && (
          <PageFilter
            spread={pages.open.length > 1}
            on={talk.pagesOnly}
            onChange={talk.setPagesOnly}
            count={shown}
          />
        )}
        {payload ? (
          <ThreadList
            entries={payload.entries}
            viewer={payload.viewer}
            setup={payload.composer}
            now={thread.loadedAt}
            h={h}
            filtered={thread.filter !== ""}
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
            tag={
              <PageTagPicker
                pages={pages}
                choice={talk.tag}
                onChange={talk.setTag}
              />
            }
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
