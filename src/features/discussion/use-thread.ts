"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadPayload } from "@/lib/discussion-thread";

// The thread's data (issue #301): fetched when the shell opens and again after
// every write — no realtime. A failed refresh keeps the list already shown and
// says so beside it. With Show on a page or the open ones (#304) it asks for
// those pages' comments, and asks again whenever the filter or the pages change.

export type ThreadState = {
  payload: ThreadPayload | null;
  error: string | null;
  /** When the payload arrived — "3 days ago" is measured from here. */
  loadedAt: number;
  /** The pages the payload was narrowed to, joined; "" for the whole thread. */
  filter: string;
};

type Fetched = { payload: ThreadPayload } | { error: string };

const UNREACHABLE =
  "The discussion couldn’t be loaded. Check your connection and try again.";

const filterKey = (pageIds: string[] | null) => pageIds?.join(",") ?? "";

async function fetchThread(issueNo: number, key: string): Promise<Fetched> {
  const query = new URLSearchParams();
  for (const id of key ? key.split(",") : []) query.append("page", id);
  const search = query.size > 0 ? `?${query}` : "";
  try {
    const res = await fetch(`/api/issues/${issueNo}/comments${search}`, {
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
  pageIds: string[] | null,
  onLoaded: (payload: ThreadPayload) => void,
) {
  const [state, setState] = useState<ThreadState>({
    payload: null,
    error: null,
    loadedAt: 0,
    filter: "",
  });
  const key = filterKey(pageIds);
  // The newest request wins: an older answer arriving late is dropped.
  const latest = useRef(0);
  const asked = useRef<string | null>(null);

  const load = useCallback(
    async (want: string): Promise<ThreadPayload | null> => {
      asked.current = want;
      const n = ++latest.current;
      const fetched = await fetchThread(issueNo, want);
      if (n !== latest.current) return null;
      if ("error" in fetched) {
        setState((s) => ({ ...s, error: fetched.error }));
        return null;
      }
      setState({
        payload: fetched.payload,
        error: null,
        loadedAt: Date.now(),
        filter: want,
      });
      onLoaded(fetched.payload);
      return fetched.payload;
    },
    [issueNo, onLoaded],
  );

  /** Loads again — narrowed to `pages` instead of the current filter when a
   *  write is about to change it, so the change doesn't fetch twice. */
  const reload = useCallback(
    (pages?: string[] | null) =>
      load(pages === undefined ? key : filterKey(pages)),
    [load, key],
  );

  // The first load, when the shell opens; then each change of filter or page.
  // Later ones follow the writes.
  useEffect(() => {
    if (asked.current !== key) void load(key);
  }, [key, load]);

  return { ...state, reload };
}
