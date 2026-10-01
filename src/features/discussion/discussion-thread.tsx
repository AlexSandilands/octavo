"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
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
import { PageTagPicker, choicePage } from "./page-tag-picker";
import { pageName, type ReaderPages } from "./page-tags";
import { FilterToggle, ThreadFilters, changedCount } from "./thread-filter";
import {
  arrange,
  matches,
  searchPattern,
  viewPages,
  viewSummary,
  type ThreadView,
} from "./thread-view";

const FILTERS = "discussion-filters";

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
// pages (#304) feed the composer's tag, the chips and the filter; the header's
// funnel opens the filter, search and sort panel.
export function DiscussionThread({
  talk,
  pages,
  sheet,
  header,
}: {
  talk: Discussion;
  pages: ReaderPages;
  /** The phone's sheet: the filters scroll with the list rather than pinned. */
  sheet: boolean;
  /** The shell's heading row, given the thread's own tools. */
  header: (tools: ReactNode) => ReactNode;
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
  // Replies a search opened (a reply matched) that the member folded again.
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

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
  // "This page" with no page open (a phone before its first section) is all.
  const view: ThreadView =
    talk.view.show === "open" && pages.open.length === 0
      ? { ...talk.view, show: "all" }
      : talk.view;
  const narrowed = viewPages(view.show, pages.open);
  const thread = useThread(info.issueNo, narrowed, onLoaded);
  const { payload } = thread;
  const arranged = payload ? arrange(payload.entries, view) : null;
  const narrowing = view.show !== "all" || view.query.trim() !== "";
  // The list the server sent is for the pages asked now, not a moment ago.
  const fresh = thread.filter === (narrowed?.join(",") ?? "");
  const summary = !narrowing
    ? ""
    : arranged && fresh
      ? viewSummary(view, arranged.count, pages)
      : thread.error
        ? ""
        : null;
  const showAll = () => {
    talk.setView((v) => ({ ...v, show: "all", query: "" }));
    requestAnimationFrame(() => toggleRef.current?.focus());
  };
  // A new search opens the threads it matches afresh.
  const changeView = (next: ThreadView) => {
    if (next.query !== view.query) setShut(new Set());
    talk.setView(next);
  };
  /** Whether the search would hide a comment with these words and name. */
  const searchHides = (body: string, name: string) => {
    const pattern = searchPattern(view.query);
    return pattern !== null && !matches(pattern, { body, name });
  };
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
    // the view would hide (on another page, or not matching the search) clears
    // the filter and the search.
    if (parentId) unfold(parentId);
    const name =
      newName ?? setup.names.find((n) => n.id === current)?.name ?? "";
    const unfilter =
      !parentId &&
      ((narrowed !== null && !(pageId !== null && narrowed.includes(pageId))) ||
        searchHides(body, name));
    if (unfilter) talk.setView((v) => ({ ...v, show: "all", query: "" }));
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

  const isUnfolded = (id: string) =>
    unfolded.has(id) ||
    replyTo === id ||
    (!!arranged?.unfold.has(id) && !shut.has(id));
  const h: ThreadHandlers = {
    isUnfolded,
    // Folding away an open reply box closes it too.
    toggleReplies: (id) => {
      const open = isUnfolded(id);
      if (open && replyTo === id) {
        setReplyTo(null);
        setReplyDraft("");
      }
      const flip = (s: ReadonlySet<string>, add: boolean) => {
        const next = new Set(s);
        if (add) next.add(id);
        else next.delete(id);
        return next;
      };
      setUnfolded((s) => flip(s, !open));
      setShut((s) => flip(s, open));
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
      // An edit the search no longer finds clears it, so the comment stays.
      const name =
        payload?.entries
          .flatMap((e) => (e.removed ? e.replies : [e, ...e.replies]))
          .find((c) => c.id === id)?.name ?? "";
      const unsearch = searchHides(body, name);
      if (unsearch) talk.setView((v) => ({ ...v, query: "" }));
      await thread.reload();
      setEditing(null);
      announce(
        unsearch
          ? "Your comment is updated. Showing every comment."
          : "Your comment is updated.",
      );
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

  const filters = (
    <ThreadFilters
      id={FILTERS}
      open={filtersOpen}
      inList={sheet}
      view={view}
      onChange={changeView}
      pages={pages}
      summary={summary}
      onShowAll={showAll}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header(
        <FilterToggle
          ref={toggleRef}
          open={filtersOpen}
          onToggle={() => {
            // In the sheet the panel heads the list: bring it into view.
            if (!filtersOpen && sheet) listRef.current?.scrollTo({ top: 0 });
            setFiltersOpen(!filtersOpen);
          }}
          changed={changedCount(view)}
          controls={FILTERS}
        />,
      )}
      {!sheet && filters}
      <div
        ref={listRef}
        className="scrollbar-soft min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]"
      >
        {sheet && filters}
        {payload && arranged && fresh ? (
          <ThreadList
            entries={arranged.entries}
            viewer={payload.viewer}
            setup={payload.composer}
            now={thread.loadedAt}
            h={h}
            query={view.query}
            narrowed={narrowing}
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
        {payload && fresh && thread.error && (
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
