import {
  stringToDoc,
  type RichBlock,
  type RichDoc,
  type RichTextValue,
} from "./rich-text-doc";

// Cutting a body-text value at top-level node boundaries — the unit the editor's
// "flow onto the next page" action moves from one page to the next (issue #93).
//
// Framework-agnostic and DOM-free on purpose: the editor measures the laid-out
// page and decides *where* to cut, this only performs the cut. Because it slices
// the structured document (never an HTML string), every mark, link and list
// survives the split intact, and both halves are ordinary content-v3 values that
// the reader and the PDF render with no idea a split ever happened.

/** The top-level nodes of a stored value; a legacy v1/v2 string is coerced first. */
export function richDocBlocks(value: RichTextValue): RichBlock[] {
  return (typeof value === "string" ? stringToDoc(value) : value).content;
}

/**
 * A document holding `blocks[start … end)`.
 *
 * JSON round-tripped, like the editor's own Tiptap write-back: nodes that came
 * from ProseMirror carry null-prototype `attrs` objects, and React Flight
 * replaces those with opaque references when the autosave posts them to the
 * server action — the save would then be rejected (issue #13).
 */
export function sliceRichDoc(
  blocks: RichBlock[],
  start: number,
  end: number,
): RichDoc {
  const doc: RichDoc = { type: "doc", content: blocks.slice(start, end) };
  return JSON.parse(JSON.stringify(doc)) as RichDoc;
}
