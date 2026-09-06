import type { Block, Page } from "@/lib/blocks";
import { pageFillsCanvas } from "@/features/blocks/layout";

// The mobile column, divided (issue #221): one section per authored page, empty
// pages dropped. `divided` means the page break — a band of canvas between two
// sheets of page — is drawn above that section.

export type ReaderSection = {
  id: string;
  cover: boolean;
  blocks: Block[];
  divided: boolean;
  /** The page is owned by one photo (#227), so its section carries no padding. */
  filled: boolean;
};

export function readerSections(pages: Page[]): ReaderSection[] {
  const sections: ReaderSection[] = [];
  for (const page of pages) {
    if (page.blocks.length === 0) continue;
    const cover = page.cover === true;
    const filled = pageFillsCanvas(page);
    const prev = sections.at(-1);
    sections.push({
      id: page.id,
      cover,
      blocks: page.blocks,
      // A photo-owned page (#227) is always a page of its own, so it is banded
      // either side — it has no heading for startsRun to find.
      divided:
        prev !== undefined &&
        (cover || prev.cover || filled || prev.filled || startsRun(page)),
      filled,
    });
  }
  return sections;
}

// Overflow flow (#93) leaves no marker on the text it splits, so a break is only
// drawn where a titled main/section heading leads the page — past any hero
// picture, since a photo-led page is as often a headline as a continuation.
function startsRun(page: Page): boolean {
  const lead = page.blocks.find(
    (b) => b.type !== "image" && b.type !== "montage" && b.type !== "video",
  );
  if (lead?.type !== "heading") return false;
  return (
    (lead.level ?? "main") !== "paragraph" &&
    (lead.title.trim() !== "" || lead.kicker.trim() !== "")
  );
}

/** Height of the break's band, scaled with the reader's text size. */
export function breakHeight(m: number) {
  return m * 0.9;
}
