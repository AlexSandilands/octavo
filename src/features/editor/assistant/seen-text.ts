import type { Page } from "@/lib/blocks";
import {
  READ_TEXT_CAP,
  VIEW_TEXT_CAP,
  textBody,
  textMarkdown,
} from "./projection";

// set_text replaces a block whole, so a block the view cut short with […] must
// have been seen uncut first, or everything after the cut is lost. A run's
// `seen` maps a block id to the text the model had whole: from a read_page
// that showed it uncut, or from its own set_text.

export type SeenText = Map<string, unknown>;

/** Why set_text may not rewrite this block yet, or null when it may. */
export function unseenText(
  seen: SeenText,
  pages: readonly Page[],
  input: unknown,
): string | null {
  const blockId = (input as { blockId?: unknown } | null)?.blockId;
  for (const [i, page] of pages.entries()) {
    const block = page.blocks.find((b) => b.id === blockId);
    if (block?.type !== "text") continue;
    const length = textMarkdown(block).length;
    if (length <= VIEW_TEXT_CAP || seen.get(block.id) === block.text)
      return null;
    return length > READ_TEXT_CAP
      ? `Error: block ${block.id} is too long to rewrite whole (${length} characters); split_page on page ${i + 1} first, then rewrite the parts. Nothing changed.`
      : `Error: you have only seen the start of block ${block.id} (the view cut it with […]); call read_page for page ${i + 1} to see it whole, then rewrite it. Nothing changed.`;
  }
  return null;
}

/** After a read_page: the long text blocks it showed uncut are seen. */
export function markRead(
  seen: SeenText,
  pages: readonly Page[],
  output: string,
) {
  for (const page of pages)
    for (const block of page.blocks) {
      if (block.type !== "text" || !output.includes(`[${block.id}] text`))
        continue;
      const md = textMarkdown(block);
      if (md.length > VIEW_TEXT_CAP && output.includes(textBody(md)))
        seen.set(block.id, block.text);
    }
}
