"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadPayload } from "@/lib/discussion-thread";

// The thread's data (issue #301): fetched when the shell opens and again after
// every write — no realtime. A failed refresh keeps the list already shown and
// says so beside it.

export type ThreadState = {
  payload: ThreadPayload | null;
  error: string | null;
  /** When the payload arrived — "3 days ago" is measured from here. */
  loadedAt: number;
};

type Fetched = { payload: ThreadPayload } | { error: string };

const UNREACHABLE =
  "The discussion couldn’t be loaded. Check your connection and try again.";

async function fetchThread(issueNo: number): Promise<Fetched> {
  try {
    const res = await fetch(`/api/issues/${issueNo}/comments`, {
      cache: "no-store",
    });
    if (res.ok) return { payload: (await res.json()) as ThreadPayload };
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { error: body?.error ?? UNREACHABLE };
  } catch {
    return { error: UNREACHABLE };
  }
}

export function useThread(
  issueNo: number,
  onLoaded: (payload: ThreadPayload) => void,
) {
  const [state, setState] = useState<ThreadState>({
    payload: null,
    error: null,
    loadedAt: 0,
  });

  const apply = useCallback(
    (fetched: Fetched): ThreadPayload | null => {
      if ("error" in fetched) {
        setState((s) => ({ ...s, error: fetched.error }));
        return null;
      }
      setState({ payload: fetched.payload, error: null, loadedAt: Date.now() });
      onLoaded(fetched.payload);
      return fetched.payload;
    },
    [onLoaded],
  );

  const reload = useCallback(
    () => fetchThread(issueNo).then(apply),
    [issueNo, apply],
  );

  // The first load, when the shell opens; later ones follow the writes.
  useEffect(() => {
    let live = true;
    void fetchThread(issueNo).then((fetched) => {
      if (live) apply(fetched);
    });
    return () => {
      live = false;
    };
  }, [issueNo, apply]);

  return { ...state, reload };
}
