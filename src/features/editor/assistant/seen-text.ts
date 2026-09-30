import type { Page } from "@/lib/blocks";
import { richDocBlocks } from "@/lib/rich-text-split";
import {
  READ_TEXT_CAP,
  VIEW_TEXT_CAP,
  textMarkdown,
  type TextBlock,
} from "./projection";

// set_text replaces a block whole, so a block the view cut short with […] must
// have been seen uncut first, or everything after the cut is lost. A run's
// `seen` maps a block id to the text the model has had whole: a read_page
// printed it uncut, or the run wrote it itself (set_text, insert_blocks).
//
// A read counts from the model's next reply on. Calls made in one reply were
// all written before any of them was answered, so a set_text beside the
// read_page that shows its block was still composed from the cut view.

/** The run's own writes are seen at once: no reply comes before this. */
const WRITTEN = -1;

export type SeenText = Map<string, { text: unknown; reply: number }>;

/** After a read_page in reply `reply`: the text blocks it printed uncut. */
export function markRead(
  seen: SeenText,
  whole: readonly TextBlock[],
  reply: number,
) {
  for (const block of whole)
    if (seen.get(block.id)?.text !== block.text)
      seen.set(block.id, { text: block.text, reply });
}

/** After a set_text or insert_blocks: the text it wrote, which is every text
 *  object that wasn't in the issue `before` it. */
export function markWritten(
  seen: SeenText,
  pages: readonly Page[],
  before: WeakSet<object>,
) {
  for (const page of pages)
    for (const block of page.blocks)
      if (
        block.type === "text" &&
        typeof block.text === "object" &&
        !before.has(block.text)
      )
        seen.set(block.id, { text: block.text, reply: WRITTEN });
}

/**
 * Why a set_text made in reply `reply` may not rewrite its block yet, or null
 * when it may. `readable` is what a read_page of a page would print uncut now,
 * so the refusal names a step that can work.
 */
export function unseenText(
  seen: SeenText,
  pages: readonly Page[],
  input: unknown,
  reply: number,
  readable: (pageNo: number) => readonly TextBlock[],
): string | null {
  const blockId = (input as { blockId?: unknown } | null)?.blockId;
  for (const [i, page] of pages.entries()) {
    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) continue;
    // A cover's text, or a block that isn't text, is set_text's own to refuse.
    if (block.type !== "text" || page.cover) return null;
    const length = textMarkdown(block).length;
    if (length <= VIEW_TEXT_CAP) return null;
    const had = seen.get(block.id);
    const shown = had !== undefined && had.text === block.text;
    if (shown && had.reply < reply) return null;
    const why = shown
      ? `you wrote this rewrite of block ${block.id} before read_page answered, from a view that cut it with […]; write it again from what read_page showed`
      : nextStep(block, length, i + 1, readable);
    return `Error: ${why}. Nothing changed.`;
  }
  return null;
}

/** What would let the model see `block` whole, if anything can. */
function nextStep(
  block: TextBlock,
  length: number,
  pageNo: number,
  readable: (pageNo: number) => readonly TextBlock[],
): string {
  const id = block.id;
  if (readable(pageNo).some((b) => b.id === id))
    return `you have only seen the start of block ${id} (the view cut it with […]); call read_page for page ${pageNo}, and rewrite it once you have the answer`;
  if (length <= READ_TEXT_CAP)
    return `page ${pageNo} is too long for read_page to show block ${id}; split_page on page ${pageNo} or move blocks off it first, then read_page and rewrite it`;
  if (richDocBlocks(block.text).length > 1)
    return `block ${id} is too long to be shown whole (${length} characters; read_page shows ${READ_TEXT_CAP}), so it can't be rewritten in one piece; split_page on page ${pageNo} divides it between paragraphs, then read_page the new pages and rewrite the parts`;
  return `block ${id} is a single paragraph or list of ${length} characters, too long to be shown whole, and split_page can't divide it, so it can't be rewritten; leave it, and tell the author it needs breaking into shorter paragraphs by hand`;
}
