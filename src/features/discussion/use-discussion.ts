"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { z } from "zod";
import type { DiscussionInfo } from "@/lib/discussion-thread";
import type { TagChoice } from "./page-tag-picker";
import { DEFAULT_VIEW, type ThreadView } from "./thread-view";

// The reader's discussion state (issue #301), shared by the desktop drawer and
// the mobile sheet: whether it is open, a composer draft that survives
// closing, the deep-linked comment, the page-tag choice (#304) and how the
// thread is filtered and sorted.
//
// The address mirrors the state: open reads `?discussion=1` (with `&comment=`
// when a link opened it that way), closed reads neither, and any other query
// is left alone. Opening pushes one history entry carrying that address and
// closing pops it, so Back closes the shell rather than leaving the issue.
// Only the native history API is used — Next's router follows it without a
// navigation, so the reader never remounts. Entries are tagged with a per-load
// token: after a reload the old ones are someone else's.

export type Discussion = {
  info: DiscussionInfo;
  open: boolean;
  show: () => void;
  hide: () => void;
  /** A `?comment=` deep link, until the thread has scrolled to it. */
  focusComment: string | null;
  clearFocusComment: () => void;
  draft: string;
  setDraft: (draft: string) => void;
  /** The page the composer tags (#304), kept with the draft until it posts. */
  tag: TagChoice | null;
  setTag: (tag: TagChoice | null) => void;
  /** The thread's filter, search and order, kept across closings too. */
  view: ThreadView;
  setView: Dispatch<SetStateAction<ThreadView>>;
};

const KEY = "__discussion";
const commentParam = z.string().regex(/^[\w-]{1,64}$/);

// `?discussion=1[&comment=<id>]`, read once as the reader mounts (it only ever
// renders in the browser).
function arrival() {
  if (typeof window === "undefined") return { open: false, comment: null };
  const params = new URLSearchParams(window.location.search);
  const comment = commentParam.safeParse(params.get("comment"));
  return {
    open: params.get("discussion") === "1",
    comment: comment.success ? comment.data : null,
  };
}

/** This address with the discussion's parameters set for `open`. */
function address(open: boolean, comment: string | null = null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("discussion");
  url.searchParams.delete("comment");
  if (open) {
    url.searchParams.set("discussion", "1");
    if (comment) url.searchParams.set("comment", comment);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useDiscussion(info: DiscussionInfo | null): Discussion | null {
  const enabled = info !== null;
  const [link] = useState(arrival);
  const [open, setOpen] = useState(enabled && link.open);
  const [focusComment, setFocusComment] = useState<string | null>(
    enabled && link.open ? link.comment : null,
  );
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState<TagChoice | null>(null);
  const [view, setView] = useState<ThreadView>(DEFAULT_VIEW);
  const token = useRef("");
  const closing = useRef(false);

  const ours = (state: unknown) =>
    token.current !== "" &&
    (state as Record<string, unknown> | null)?.[KEY] === token.current;
  const mint = () => (token.current ||= Math.random().toString(36).slice(2));

  // At most one entry for an open shell, however often this runs. An arrival
  // already open (a deep link, a reload) first clears the entry it came in on,
  // so the Back that closes the shell lands on the plain reader.
  const enter = (comment: string | null, arriving: boolean) => {
    closing.current = false;
    if (ours(window.history.state)) return;
    if (arriving) {
      window.history.replaceState(window.history.state, "", address(false));
    }
    window.history.pushState({ [KEY]: mint() }, "", address(true, comment));
  };

  const show = () => {
    enter(null, false);
    setOpen(true);
  };

  // A second close while the first Back is in flight would pop the page too.
  const hide = () => {
    if (closing.current) return;
    if (ours(window.history.state)) {
      closing.current = true;
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", address(false));
      setOpen(false);
    }
  };

  // Back and Forward: the entry we land on says whether the shell is open. An
  // open address from before a reload is adopted, so the two never disagree.
  useEffect(() => {
    if (!enabled) return;
    const onPop = (e: PopStateEvent) => {
      closing.current = false;
      const params = new URLSearchParams(window.location.search);
      const adopt = !ours(e.state) && params.get("discussion") === "1";
      if (adopt) {
        window.history.replaceState({ ...e.state, [KEY]: mint() }, "");
      }
      setOpen(adopt || ours(e.state));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  // A deep link (or a reload while open) opens the shell on load.
  useEffect(() => {
    if (enabled && link.open) enter(link.comment, true);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, link.open]);

  if (!info) return null;
  return {
    info,
    open,
    show,
    hide,
    focusComment,
    clearFocusComment: () => setFocusComment(null),
    draft,
    setDraft,
    tag,
    setTag,
    view,
    setView,
  };
}
