import { isPageOwning, type Page } from "@/lib/blocks";
import { refuse } from "./refusal";

// Where the assistant's page edits may act: never on a cover (it has its own
// tools) or beside a full-page photo.

export function editable(pages: Page[], pageIdx: number): Page {
  const page =
    pages[pageIdx] ??
    refuse(
      `there is no page ${pageIdx + 1}; the issue has ${pages.length} pages`,
    );
  if (page.cover)
    refuse(
      `page ${pageIdx + 1} is a cover; use the cover tools (set_masthead, add_story, place_cover_item, style_cover_item …) for it`,
    );
  return page;
}

export const ownedByPhoto = (page: Page, pageNo: number) =>
  page.blocks.some(isPageOwning) &&
  refuse(`page ${pageNo} is a full-page photo; nothing else can go on it`);
