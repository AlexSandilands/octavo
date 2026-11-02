import { Fragment, type ReactNode } from "react";
import { externalHref } from "@/lib/rich-text";
import {
  stringToDoc,
  type RichBlock,
  type RichInline,
  type RichMark,
  type RichTextNode,
  type RichTextValue,
} from "@/lib/rich-text-doc";

// Renders a body-text block's stored value (structured doc from content v3, or a
// legacy plain-text/HTML string) as React elements — the replacement for the old
// `dangerouslySetInnerHTML` + regex-sanitiser path. Text is escaped by React, so
// there is no XSS surface: the only elements emitted are the fixed themed tag set
// below, and link hrefs are re-validated through `externalHref` (an unsafe one
// renders as plain text). Server-safe, no client deps — shared by both readers,
// the cover thumb and the PDF path. Wrap it in a `.rich-text` container for the
// shared paragraph/list/link styling (see globals.css). `anchors={false}` sets
// links as plain text, for a render that sits inside its own link or button.
export function RichText({
  value,
  anchors = true,
}: {
  value: RichTextValue;
  anchors?: boolean;
}) {
  const doc = typeof value === "string" ? stringToDoc(value) : value;
  return <>{doc.content.map((block, i) => renderBlock(block, i, anchors))}</>;
}

function renderBlock(
  block: RichBlock,
  key: number,
  anchors: boolean,
): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{renderInline(block.content, anchors)}</p>;
    case "bulletList":
      return <ul key={key}>{renderItems(block.content, anchors)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderItems(block.content, anchors)}</ol>;
  }
}

function renderItems(
  items: { content: RichBlock[] }[],
  anchors: boolean,
): ReactNode {
  return items.map((li, i) => (
    <li key={i}>{li.content.map((b, j) => renderBlock(b, j, anchors))}</li>
  ));
}

function renderInline(
  content: RichInline[] | undefined,
  anchors: boolean,
): ReactNode {
  return (content ?? []).map((node, i) =>
    node.type === "hardBreak" ? <br key={i} /> : renderText(node, i, anchors),
  );
}

function renderText(
  node: RichTextNode,
  key: number,
  anchors: boolean,
): ReactNode {
  // Wrap so the first mark in the array is the outermost element, mirroring the
  // source nesting order (Tiptap's stored order; a legacy <strong><em> parses to
  // [bold, italic]). Nested inline formatting is visually order-independent, but
  // matching the order keeps output identical to the pre-v3 render.
  const marks = node.marks ?? [];
  let el: ReactNode = node.text;
  for (let k = marks.length - 1; k >= 0; k--)
    el = wrapMark(marks[k]!, el, anchors);
  return <Fragment key={key}>{el}</Fragment>;
}

function wrapMark(
  mark: RichMark,
  child: ReactNode,
  anchors: boolean,
): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{child}</strong>;
    case "italic":
      return <em>{child}</em>;
    case "underline":
      return <u>{child}</u>;
    case "strike":
      return <s>{child}</s>;
    case "link": {
      // Re-validate at render too (defence in depth): stored data is already
      // normalised on save, but reads are not re-parsed, so an unsafe href here
      // renders as plain text rather than a live link.
      const href = anchors ? externalHref(mark.attrs.href) : null;
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {child}
        </a>
      ) : (
        child
      );
    }
  }
}
