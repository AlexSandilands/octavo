"use client";

import { useEffect, useRef } from "react";
import type { ThreadPayload } from "@/lib/discussion-thread";
import { commentDomId } from "./comment-item";

export const MAIN_COMPOSER = "discussion-composer";

export type Target = {
  id: string;
  /** Where focus lands: the comment itself, or back in the main box. */
  focus: "comment" | "composer";
  /** A deep link's comment lights up briefly; a write's doesn't. */
  highlight: boolean;
};

// Where the thread goes after a load (issue #301): a `?comment=` deep link's
// comment first, then whatever each write lands on — scrolled to, focused and,
// for a deep link, highlighted for a moment. A deep link to a comment that has
// gone leaves the list at its top and says so.
export function useCommentTarget(
  payload: ThreadPayload | null,
  first: string | null,
  o: {
    list: React.RefObject<HTMLDivElement | null>;
    announce: (text: string) => void;
    onDeepLinkDone: () => void;
  },
) {
  const target = useRef<Target | null>(
    first ? { id: first, focus: "comment", highlight: true } : null,
  );

  useEffect(() => {
    const t = target.current;
    if (!payload || !t) return;
    target.current = null;
    if (t.highlight) o.onDeepLinkDone();
    const el = document.getElementById(commentDomId(t.id));
    if (!el) {
      o.list.current?.scrollTo({ top: 0 });
      if (t.highlight) {
        requestAnimationFrame(() =>
          o.announce("That comment is no longer in the discussion."),
        );
      }
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    el.scrollIntoView({
      block: "center",
      behavior: reduce.matches ? "auto" : "smooth",
    });
    const focus =
      t.focus === "composer" ? document.getElementById(MAIN_COMPOSER) : el;
    focus?.focus({ preventScroll: true });
    if (t.highlight) {
      el.dataset.highlight = "true";
      window.setTimeout(() => delete el.dataset.highlight, 2500);
    }
    // Runs per load; the options are read fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  /** Aims the next load at a comment. */
  return (next: Target) => {
    target.current = next;
  };
}
