import { blockSchema, type Block } from "@/lib/blocks";
import { createId } from "@/lib/id";
import {
  richTextToPlain,
  richDocSchema,
  type RichDoc,
  type RichInline,
  type Paragraph,
} from "@/lib/rich-text-doc";
import type { Region, ReviewItem, SourceMapping } from "./model";

export function reviewItem(region: Region): ReviewItem {
  const id = createId();
  const block: Block =
    region.kind === "image"
      ? {
          id,
          type: "image",
          imageId: id,
          caption: "",
          alt: "",
          align: "full",
          width: 100,
        }
      : region.heading
        ? {
            id,
            type: "heading",
            title: richTextToPlain(region.doc),
            kicker: "",
            level: region.level,
          }
        : {
            id,
            type: "text",
            text: region.doc,
            size: region.size,
            align: region.align,
          };
  return {
    id,
    sources: [region.id],
    page: region.page,
    order: region.order,
    region,
    block,
  };
}
export function sourceState(
  ids: string[],
  pages: { blocks: Block[] }[],
): "imported" | "partial" | null {
  const present = new Set(pages.flatMap((p) => p.blocks.map((b) => b.id)));
  const count = ids.filter((id) => present.has(id)).length;
  return count === 0 ? null : count === ids.length ? "imported" : "partial";
}

/** Exact offset cuts keep marks and whitespace; they never trim either side. */
export function cutParagraph(
  paragraph: Paragraph,
  at: number,
): [Paragraph, Paragraph] {
  const plain = (paragraph.content ?? [])
    .map((r) => (r.type === "text" ? r.text : "\n"))
    .join("");
  if (
    /[\uD800-\uDBFF]/.test(plain.charAt(at - 1)) &&
    /[\uDC00-\uDFFF]/.test(plain.charAt(at))
  )
    at--;
  const left: RichInline[] = [],
    right: RichInline[] = [];
  let offset = 0;
  for (const node of paragraph.content ?? []) {
    const length = node.type === "text" ? node.text.length : 1;
    const cut = Math.max(0, Math.min(length, at - offset));
    if (node.type === "hardBreak") (cut ? left : right).push(node);
    else {
      if (cut) left.push({ ...node, text: node.text.slice(0, cut) });
      if (cut < length) right.push({ ...node, text: node.text.slice(cut) });
    }
    offset += length;
  }
  return [
    { type: "paragraph", content: left },
    { type: "paragraph", content: right },
  ];
}
export function paragraphLength(paragraph: Paragraph) {
  return (paragraph.content ?? []).reduce(
    (n, r) => n + (r.type === "text" ? r.text.length : 1),
    0,
  );
}
export function splitReview(item: ReviewItem): ReviewItem[] {
  if (item.block.type !== "text" || typeof item.block.text === "string")
    return [item];
  const doc = item.block.text;
  let parts: RichDoc[];
  if (doc.content.length > 1)
    parts = doc.content.map((p) => ({ type: "doc", content: [p] }));
  else {
    const p = doc.content[0];
    if (!p || p.type !== "paragraph") return [item];
    const text = richTextToPlain(doc);
    let cut = text.lastIndexOf(" ", Math.floor(text.length / 2));
    if (cut <= 0) cut = Math.floor(text.length / 2);
    if (!cut) return [item];
    parts = cutParagraph(p, cut).map((paragraph) => ({
      type: "doc",
      content: [paragraph],
    }));
  }
  return parts.map((text) => {
    const id = createId();
    return {
      ...item,
      id,
      block: { ...item.block, id, type: "text", text } as Block,
    };
  });
}
function splitRun(r: Extract<RichInline, { type: "text" }>): RichInline[] {
  const result: RichInline[] = [];
  for (let at = 0; at < r.text.length; ) {
    let end = Math.min(at + 8000, r.text.length);
    if (
      /[\uD800-\uDBFF]/.test(r.text.charAt(end - 1)) &&
      /[\uDC00-\uDFFF]/.test(r.text.charAt(end))
    )
      end--;
    result.push({ ...r, text: r.text.slice(at, end) });
    at = end;
  }
  return result;
}
export function synthesize(items: ReviewItem[]): {
  blocks: Block[];
  mapping: SourceMapping;
} {
  const blocks: Block[] = [],
    mapping: SourceMapping = {};
  for (const item of items) {
    const emitted: Block[] = [];
    if (item.block.type === "text" && typeof item.block.text !== "string") {
      let content: RichDoc["content"] = [];
      for (const paragraph of item.block.text.content) {
        if (paragraph.type !== "paragraph")
          throw new Error(
            "Use paragraphs in the import preview; lists can be added in the magazine editor.",
          );
        // Bound long runs before checking the document's run/node limits.
        const nodes = (paragraph.content ?? []).flatMap((r): RichInline[] =>
          r.type === "hardBreak" ? [r] : splitRun(r),
        );
        const chunks: Paragraph[] = [];
        for (let i = 0; i < Math.max(1, nodes.length); i += 200)
          chunks.push({ type: "paragraph", content: nodes.slice(i, i + 200) });
        for (const chunk of chunks) {
          if (
            !richDocSchema.safeParse({
              type: "doc",
              content: [...content, chunk],
            }).success &&
            content.length
          ) {
            emitted.push({
              ...item.block,
              id: emitted.length ? createId() : item.id,
              text: { type: "doc", content },
            });
            content = [];
          }
          if (
            !richDocSchema.safeParse({ type: "doc", content: [chunk] }).success
          )
            throw new Error(
              "This paragraph is too large. Split it in the review tray before adding.",
            );
          content.push(chunk);
        }
      }
      if (content.length)
        emitted.push({
          ...item.block,
          id: emitted.length ? createId() : item.id,
          text: { type: "doc", content },
        });
    } else emitted.push(item.block);
    for (const block of emitted) {
      const parsed = blockSchema.safeParse(block);
      if (!parsed.success)
        throw new Error(
          block.type === "heading"
            ? "Heading exceeds 300 characters. Shorten it or change its type to Text."
            : "Review the content: a field exceeds the magazine limits.",
        );
      blocks.push(parsed.data);
      for (const source of item.sources)
        (mapping[source] ??= []).push(block.id);
    }
  }
  if (!blocks.length) throw new Error("Select some text or an image first.");
  return { blocks, mapping };
}
