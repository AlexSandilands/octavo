import type { Block, IssueContent } from "@/lib/blocks";

// How the mobile column is divided (issue #221). The phone reader has no pages,
// so each authored page becomes one section and the ones that start something
// new carry a break above them — extra space and a hairline, the same soft rule
// the closing wordmark uses.
//
// The grain is a page, not a two-page spread: in practice a new article or
// section head lands on most pages, so pairing them would hide half the breaks
// the author made — and the reader is scrolling a column, where a spread is not
// a thing they can see.

export type ReaderSection = {
  id: string;
  cover: boolean;
  blocks: Block[];
  /** Draw the page break above this section. */
  divided: boolean;
};

/** Authored pages as the mobile column renders them; empty pages are dropped. */
export function readerSections(pages: IssueContent["pages"]): ReaderSection[] {
  const sections: ReaderSection[] = [];
  for (const page of pages) {
    if (page.blocks.length === 0) continue;
    const cover = page.cover === true;
    sections.push({
      id: page.id,
      cover,
      blocks: page.blocks,
      divided:
        sections.length > 0 &&
        (cover || sections[sections.length - 1]!.cover || startsRun(page)),
    });
  }
  return sections;
}

// Overflow flow (#93) leaves no mark on the text it splits — a continuation is
// an ordinary text block on an ordinary page — so a break is only drawn where a
// titled main/section heading leads the page. That never falls inside a run of
// body text carried over from the page before, and a run-in sub-head (level
// "paragraph") stays part of the article it continues.
function startsRun(page: IssueContent["pages"][number]): boolean {
  const first = page.blocks[0];
  if (first?.type !== "heading") return false;
  return (
    (first.level ?? "main") !== "paragraph" &&
    (first.title.trim() !== "" || first.kicker.trim() !== "")
  );
}

/**
 * Space around the break, scaled by the reader's base text size so it stays a
 * page break rather than a gap at 26px.
 */
export function breakSpacing(m: number) {
  return { marginTop: m * 1.75, paddingTop: m * 1.5 };
}
