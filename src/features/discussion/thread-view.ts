import type { ThreadComment, ThreadEntry } from "@/lib/discussion-thread";
import { pageName, type ReaderPages } from "./page-tags";

// How a member is looking at the thread: which comments, in what order, and
// what they searched for. Narrowing to pages happens on the server (#304);
// the rest is done here, on the list already loaded.

/** "open" follows the page(s) open now; "page:<id>" is one chosen page. */
export type ThreadShow = "all" | "open" | "mine" | `page:${string}`;
export type ThreadSort = "oldest" | "newest" | "replies";
export type ThreadView = { show: ThreadShow; sort: ThreadSort; query: string };

export const DEFAULT_VIEW: ThreadView = {
  show: "all",
  sort: "oldest",
  query: "",
};

export const SEARCH_MAX = 100;

/** The pages the list route is asked for, or null for the whole thread. */
export function viewPages(show: ThreadShow, open: string[]): string[] | null {
  if (show === "open") return open.length > 0 ? open : null;
  if (show.startsWith("page:")) return [show.slice("page:".length)];
  return null;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A case-blind pattern for the search, or null when there is none. With
 *  `split`, it captures, so `text.split` alternates misses and matches. */
export function searchPattern(query: string, split = false): RegExp | null {
  const q = query.trim();
  if (!q) return null;
  return split
    ? new RegExp(`(${escape(q)})`, "giu")
    : new RegExp(escape(q), "iu");
}

/** Whether a comment's words or name hold the search. */
export const matches = (pattern: RegExp, c: { body: string; name: string }) =>
  pattern.test(c.body) || pattern.test(c.name);

/** The thread as the view has it; how many comments it holds (with a search
 *  or My comments, the ones that match, replies included); and the threads
 *  whose replies are open because a reply is what matched. */
export function arrange(
  entries: ThreadEntry[],
  view: ThreadView,
): { entries: ThreadEntry[]; count: number; unfold: ReadonlySet<string> } {
  const pattern = searchPattern(view.query);
  const mine = view.show === "mine";
  const wanted = (c: ThreadComment) =>
    (!mine || c.isMine) && (!pattern || matches(pattern, c));
  const unfold = new Set<string>();
  let count = 0;
  const kept =
    mine || pattern
      ? entries.filter((e) => {
          const top = !e.removed && wanted(e);
          const replies = e.replies.filter(wanted).length;
          if (replies > 0) unfold.add(e.id);
          count += Number(top) + replies;
          return top || replies > 0;
        })
      : [...entries];
  if (!mine && !pattern) count = kept.filter((e) => !e.removed).length;
  // Stable sorts, so ties stay oldest first.
  if (view.sort === "newest") {
    kept.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } else if (view.sort === "replies") {
    kept.sort((a, b) => b.replies.length - a.replies.length);
  }
  return { entries: kept, count, unfold };
}

/** "3 comments on this page", "No comments by you yet", "1 comment matching
 *  “garden”" — what the narrowed list holds. */
export function viewSummary(
  view: ThreadView,
  count: number,
  pages: ReaderPages,
): string {
  const page = viewPages(view.show, pages.open);
  const where =
    view.show === "mine"
      ? " by you"
      : view.show === "open"
        ? pages.open.length > 1
          ? " on these pages"
          : " on this page"
        : page
          ? ` on ${pageName(pages, page[0]!) ?? "a removed page"}`
          : "";
  const head =
    count === 0
      ? "No comments"
      : `${count} ${count === 1 ? "comment" : "comments"}`;
  const q = view.query.trim();
  if (q) return `${head}${where} matching “${q}”`;
  return `${head}${where}${count === 0 ? " yet" : ""}`;
}
