"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { DiscussionInfo } from "@/lib/discussion-thread";

// The reader's discussion state (issue #301), shared by the desktop drawer and
// the mobile sheet: whether it is open, the count on its control, a composer
// draft that survives closing, and the deep-linked comment.
//
// Opening pushes a history entry and closing pops it, so the phone's Back
// button (and the browser's) closes the shell rather than leaving the issue.
// Entries are tagged with a per-load token: after a reload the old ones are
// someone else's, and a Back onto them must not reopen anything.

export type Discussion = {
  info: DiscussionInfo;
  open: boolean;
  show: () => void;
  hide: () => void;
  count: number | null;
  setCount: (count: number) => void;
  /** A `?comment=` deep link, until the thread has scrolled to it. */
  focusComment: string | null;
  clearFocusComment: () => void;
  draft: string;
  setDraft: (draft: string) => void;
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

export function useDiscussion(info: DiscussionInfo | null): Discussion | null {
  const enabled = info !== null;
  const [link] = useState(arrival);
  const [open, setOpen] = useState(enabled && link.open);
  const [count, setCount] = useState(info?.count ?? null);
  const [focusComment, setFocusComment] = useState<string | null>(
    enabled && link.open ? link.comment : null,
  );
  const [draft, setDraft] = useState("");
  const token = useRef("");
  const closing = useRef(false);

  const ours = (state: unknown) =>
    token.current !== "" &&
    (state as Record<string, unknown> | null)?.[KEY] === token.current;

  // At most one entry for an open shell, however often this runs.
  const enter = () => {
    token.current ||= Math.random().toString(36).slice(2);
    if (!ours(window.history.state)) {
      window.history.pushState({ [KEY]: token.current }, "");
    }
    closing.current = false;
  };

  const show = () => {
    enter();
    setOpen(true);
  };

  // A second close while the first Back is in flight would pop the page too.
  const hide = () => {
    if (closing.current) return;
    if (ours(window.history.state)) {
      closing.current = true;
      window.history.back();
    } else {
      setOpen(false);
    }
  };

  // Back and Forward: the entry we land on says whether the shell is open.
  useEffect(() => {
    if (!enabled) return;
    const onPop = (e: PopStateEvent) => {
      closing.current = false;
      setOpen(ours(e.state));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  // A deep link opens the shell on load, on a history entry of its own above
  // the link's, so Back closes it before it leaves the issue. The address is
  // left as it came: it is what the link says.
  useEffect(() => {
    if (enabled && link.open) enter();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, link.open]);

  if (!info) return null;
  return {
    info,
    open,
    show,
    hide,
    count,
    setCount,
    focusComment,
    clearFocusComment: () => setFocusComment(null),
    draft,
    setDraft,
  };
}
