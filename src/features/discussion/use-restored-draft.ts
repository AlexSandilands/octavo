"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadComment, ThreadPayload } from "@/lib/discussion-thread";
import type { PageIndex } from "./page-tags";
import { takeDraft, type StaleDraft } from "./stale-draft";

// The other half of the stale-reload draft (#132): on the thread's first load
// after a reload, the kept draft is read (and so removed) and checked against
// what the thread now holds. A draft whose target has gone, or is no longer
// the member's to edit or to report, is dropped. Nothing is ever sent again.

/** The draft as it can still be put back, or null. */
export function restorable(
  draft: StaleDraft,
  payload: ThreadPayload,
  pages: PageIndex,
): StaleDraft | null {
  const firstPost = payload.composer.names.length === 0;
  const live = (c: ThreadComment | undefined) =>
    c !== undefined && !c.hidden && !c.deleted;
  const comments = payload.entries.flatMap((e) =>
    e.removed ? e.replies : [e, ...e.replies],
  );
  const find = (id: string) => comments.find((c) => c.id === id);
  switch (draft.kind) {
    case "comment":
      return {
        ...draft,
        pageId:
          draft.pageId && pages.numbers.has(draft.pageId) ? draft.pageId : null,
        newName: firstPost ? draft.newName : null,
      };
    case "reply": {
      const parent = payload.entries.find((e) => e.id === draft.parentId);
      return parent && !parent.removed && live(parent)
        ? { ...draft, newName: firstPost ? draft.newName : null }
        : null;
    }
    case "edit": {
      const c = find(draft.commentId);
      return live(c) && c!.isMine ? draft : null;
    }
    case "report": {
      const c = find(draft.commentId);
      return payload.viewer === "member" && live(c) && !c!.isMine
        ? draft
        : null;
    }
  }
}

/**
 * `onFirstLoad` goes in the thread's load callback, so `apply` (which opens
 * the right box) lands in the same render as the list. `restored` is the draft
 * for that render only: the boxes read it as they mount, then it is cleared,
 * so a box that mounts again later starts afresh.
 */
export function useRestoredDraft(
  issueNo: number,
  pages: PageIndex,
  apply: (draft: StaleDraft, payload: ThreadPayload) => void,
) {
  const [restored, setRestored] = useState<StaleDraft | null>(null);
  const tried = useRef(false);
  const latest = useRef({ pages, apply });
  useEffect(() => {
    latest.current = { pages, apply };
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one render only
    if (restored) setRestored(null);
  }, [restored]);

  const onFirstLoad = useCallback(
    (payload: ThreadPayload) => {
      if (tried.current) return;
      tried.current = true;
      const draft = takeDraft(issueNo);
      const back = draft && restorable(draft, payload, latest.current.pages);
      if (!back) return;
      setRestored(back);
      latest.current.apply(back, payload);
    },
    [issueNo],
  );

  return { restored, onFirstLoad };
}
