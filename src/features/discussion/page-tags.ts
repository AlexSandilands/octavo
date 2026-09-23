import type { Page } from "@/lib/blocks";

// Page tags (issue #304). A comment stores the page's id, never its number:
// ids survive an overflow split renumbering the pages, so the number is looked
// up afresh from the issue the reader has open, and a page since deleted has
// none at all.

/** Every page's number (its place in the issue) by id. */
export type PageIndex = {
  numbers: ReadonlyMap<string, number>;
  /** Page 1 is a cover, so it is named "the cover". */
  coverFirst: boolean;
};

/** What a reader tells its discussion about the pages. */
export type ReaderPages = PageIndex & {
  /** The pages the member has open: one, or both halves of a spread. */
  open: string[];
  /** Takes the reader to a page. */
  go: (pageId: string) => void;
};

/** The index of the issue's pages as they stand now. */
export function pageIndex(pages: Page[]): PageIndex {
  return {
    numbers: new Map(pages.map((page, i) => [page.id, i + 1])),
    coverFirst: pages[0]?.cover === true,
  };
}

/** "the cover" or "page 12"; null for a page no longer in the issue. */
export function pageName(pages: PageIndex, pageId: string): string | null {
  const n = pages.numbers.get(pageId);
  if (n === undefined) return null;
  return n === 1 && pages.coverFirst ? "the cover" : `page ${n}`;
}

export const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
