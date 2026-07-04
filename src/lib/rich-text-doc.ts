// The structured rich-text document a body-text block holds from content v3 on.
// It mirrors the Tiptap JSON the editor produces (`editor.getJSON()`) for the
// closed feature set the toolbar exposes — paragraphs, bullet/numbered lists,
// and text runs carrying bold/italic/underline/strike/link marks. Storing the
// *structure* (not an HTML string) lets the readers render it through React
// elements, so text is escaped by construction and there is no
// `dangerouslySetInnerHTML` and no regex HTML sanitiser in the read path.
//
// Two jobs, both framework-agnostic (no client deps) so the readers, the
// library cover thumb, the editor seed and the PDF path can all use them:
//   - `richDocSchema` validates a document on save. Every array is bounded, the
//     list nesting is depth-capped, and the whole doc is size-capped, so a
//     malicious or runaway save can't persist an unbounded document (mirrors the
//     string caps the old HTML column had). Link hrefs are re-validated through
//     `externalHref`; an unsafe one (javascript:, data:, …) drops the link mark.
//   - `stringToDoc` converts a *legacy* stored value (v1/v2 held a plain-text or
//     constrained-HTML string) into the same doc shape, so old rows render
//     through the identical React path. This is the compatibility fallback and
//     the one-off migration's converter; it is not an XSS boundary — its output
//     is React-rendered (escaped) and its links go through `externalHref`.

import { z } from "zod";
import { externalHref } from "./rich-text";

// Caps. Far above anything a real body-text block needs; they exist so a bad
// save can't persist an unbounded document. The total-chars/-nodes refine is the
// hard ceiling regardless of how the nesting is arranged.
const MAX_TEXT = 8_000; // one text run
const MAX_MARKS = 6; // marks on one run (bold/italic/underline/strike/link + head-room)
const MAX_INLINE = 300; // runs + breaks in one paragraph
const MAX_LIST_ITEMS = 200; // <li> in one list
const MAX_ITEM_CONTENT = 60; // blocks in one <li>
const MAX_DOC_BLOCKS = 200; // top-level blocks
const MAX_LIST_DEPTH = 4; // how deep lists may nest
const HREF_MAX = 2_000;
const MAX_TOTAL_CHARS = 40_000; // summed text across the whole doc
const MAX_TOTAL_NODES = 4_000; // nodes across the whole doc

// --- Rendered types (what the schema yields and the renderer walks) ----------
// Hand-written so the renderer has clean types; the schema below is built to
// produce exactly these (link marks normalised to `{ href }`).

export type RichMark =
  | { type: "bold" | "italic" | "underline" | "strike" }
  | { type: "link"; attrs: { href: string } };
export type RichTextNode = { type: "text"; text: string; marks?: RichMark[] };
export type HardBreak = { type: "hardBreak" };
export type RichInline = RichTextNode | HardBreak;
export type Paragraph = { type: "paragraph"; content?: RichInline[] };
export type ListItem = { type: "listItem"; content: RichBlock[] };
export type BulletList = { type: "bulletList"; content: ListItem[] };
export type OrderedList = { type: "orderedList"; content: ListItem[] };
export type RichBlock = Paragraph | BulletList | OrderedList;
export type RichDoc = { type: "doc"; content: RichBlock[] };

// --- Zod schema --------------------------------------------------------------

const boldMark = z.object({ type: z.literal("bold") });
const italicMark = z.object({ type: z.literal("italic") });
const underlineMark = z.object({ type: z.literal("underline") });
const strikeMark = z.object({ type: z.literal("strike") });
// Tiptap serialises a link with href plus its default target/rel (and sometimes
// a null class). Accept and then drop everything but a validated href — the
// renderer forces the safe target/rel itself.
const linkMark = z.object({
  type: z.literal("link"),
  attrs: z.object({
    href: z.string().max(HREF_MAX),
    target: z.string().max(24).nullish(),
    rel: z.string().max(80).nullish(),
    class: z.string().max(80).nullish(),
  }),
});

const markSchema = z.discriminatedUnion("type", [
  boldMark,
  italicMark,
  underlineMark,
  strikeMark,
  linkMark,
]);

// A text run. On parse, link marks are re-validated through `externalHref`:
// an unsafe href drops the whole link mark (the text stays, un-linked), and a
// safe one is normalised to `{ href }`. So a `javascript:`/`data:` link saved
// directly can't survive into stored content.
const textNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(MAX_TEXT),
    marks: z.array(markSchema).max(MAX_MARKS).optional(),
  })
  .transform((node): RichTextNode => {
    if (!node.marks?.length) return { type: "text", text: node.text };
    const marks: RichMark[] = [];
    for (const m of node.marks) {
      if (m.type !== "link") {
        if (!marks.some((x) => x.type === m.type)) marks.push({ type: m.type });
        continue;
      }
      const href = externalHref(m.attrs.href);
      if (href && !marks.some((x) => x.type === "link"))
        marks.push({ type: "link", attrs: { href } });
    }
    return marks.length
      ? { type: "text", text: node.text, marks }
      : { type: "text", text: node.text };
  });

const hardBreakSchema = z.object({ type: z.literal("hardBreak") });
const inlineSchema = z.union([textNodeSchema, hardBreakSchema]);

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).max(MAX_INLINE).optional(),
});

// Build the list schemas depth-first: a list item at the deepest allowed level
// may hold only paragraphs; each shallower level additionally admits the lists
// one level down. Unrolling the recursion this way bounds nesting structurally
// (no runtime depth counter, no unbounded `z.lazy`).
function buildLists() {
  let bullet: z.ZodTypeAny | null = null;
  let ordered: z.ZodTypeAny | null = null;
  for (let depth = 0; depth <= MAX_LIST_DEPTH; depth++) {
    const itemContent: z.ZodTypeAny =
      depth > 0 && bullet && ordered
        ? z.union([paragraphSchema, bullet, ordered])
        : paragraphSchema;
    const listItem: z.ZodTypeAny = z.object({
      type: z.literal("listItem"),
      content: z.array(itemContent).min(1).max(MAX_ITEM_CONTENT),
    });
    bullet = z.object({
      type: z.literal("bulletList"),
      content: z.array(listItem).min(1).max(MAX_LIST_ITEMS),
    });
    ordered = z.object({
      type: z.literal("orderedList"),
      content: z.array(listItem).min(1).max(MAX_LIST_ITEMS),
    });
  }
  return { bullet: bullet!, ordered: ordered! };
}

const { bullet: bulletListSchema, ordered: orderedListSchema } = buildLists();

const blockSchema = z.union([
  paragraphSchema,
  bulletListSchema,
  orderedListSchema,
]);

// Hard ceiling on the whole document: walk the parsed tree, summing text length
// and node count. Independent of how the caps above are arranged, this rejects
// a size/count bomb.
function withinBudget(doc: { content: unknown[] }): boolean {
  let chars = 0;
  let nodes = 0;
  const walk = (n: unknown): boolean => {
    if (!n || typeof n !== "object") return true;
    if (++nodes > MAX_TOTAL_NODES) return false;
    const node = n as { text?: unknown; content?: unknown };
    if (typeof node.text === "string") {
      chars += node.text.length;
      if (chars > MAX_TOTAL_CHARS) return false;
    }
    if (Array.isArray(node.content))
      for (const c of node.content) if (!walk(c)) return false;
    return true;
  };
  return doc.content.every(walk);
}

export const richDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(blockSchema).max(MAX_DOC_BLOCKS),
  })
  .refine(withinBudget, {
    message: "rich-text document exceeds the size/node budget",
  }) as unknown as z.ZodType<RichDoc, z.ZodTypeDef, unknown>;

// The stored value of a text block: the structured doc (v3), or a legacy
// plain-text / constrained-HTML string (v1/v2). Both remain valid forever; the
// readers coerce a string through `stringToDoc`.
export const richTextValueSchema = z.union([
  z.string().max(MAX_TOTAL_CHARS),
  richDocSchema,
]);
export type RichTextValue = z.infer<typeof richTextValueSchema>;

// --- Legacy string → doc conversion ------------------------------------------

// True when the value carries markup (came from the old rich editor); a legacy
// plain-text block has none. Mirrors the tag set the old sanitiser allowed.
function looksLikeHtml(text: string): boolean {
  return /<(p|br|strong|b|em|i|u|s|ul|ol|li|a)\b|<\/(p|ul|ol|li|a)>/i.test(text);
}

function decodeEntities(s: string): string {
  const cp = (n: number) =>
    n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" decodes to "&lt;" not "<"
}

type Tok =
  | { t: "open"; name: string; attrs: string }
  | { t: "close"; name: string }
  | { t: "text"; text: string };

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const BLOCK_TAGS = new Set(["p", "ul", "ol", "li"]);

function tokenize(html: string): Tok[] {
  const toks: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(html))) {
    if (m.index > last) {
      const text = decodeEntities(html.slice(last, m.index));
      if (text) toks.push({ t: "text", text });
    }
    const name = m[2]!.toLowerCase();
    if (m[1]) toks.push({ t: "close", name });
    else toks.push({ t: "open", name, attrs: m[3]! });
    last = TAG.lastIndex;
  }
  if (last < html.length) {
    const text = decodeEntities(html.slice(last));
    if (text) toks.push({ t: "text", text });
  }
  return toks;
}

// A mark tag maps to a mark; an <a> maps to a link (or, when its href is unsafe,
// to "container": render the inner text but drop the link).
function markFor(name: string, attrs: string): RichMark | "container" | null {
  switch (name) {
    case "strong":
    case "b":
      return { type: "bold" };
    case "em":
    case "i":
      return { type: "italic" };
    case "u":
      return { type: "underline" };
    case "s":
    case "strike":
    case "del":
      return { type: "strike" };
    case "a": {
      const raw = attrs.match(
        /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i,
      );
      const href = raw ? externalHref(raw[2] ?? raw[3] ?? raw[4] ?? "") : null;
      return href ? { type: "link", attrs: { href } } : "container";
    }
    default:
      return null;
  }
}

// Parse a constrained-HTML string (or plain text) into a RichDoc. Well-formed
// Tiptap output is the expected input; malformed markup is tolerated (unknown
// tags dropped, stray closes ignored, loose inline wrapped in a paragraph).
export function stringToDoc(input: string): RichDoc {
  if (!input) return { type: "doc", content: [] };
  if (!looksLikeHtml(input))
    return { type: "doc", content: [plainParagraph(input)] };

  const toks = tokenize(input);
  let i = 0;

  const withMark = (marks: RichMark[], mark: RichMark): RichMark[] =>
    marks.some((x) => x.type === mark.type) ? marks : [...marks, mark];

  function parseInline(stop: string, marks: RichMark[]): RichInline[] {
    const out: RichInline[] = [];
    while (i < toks.length) {
      const tk = toks[i]!;
      if (tk.t === "close") {
        if (tk.name === stop) return out; // caller consumes the close
        i++; // stray close — drop
        continue;
      }
      if (tk.t === "text") {
        out.push(mkText(tk.text, marks));
        i++;
        continue;
      }
      // open
      if (tk.name === "br") {
        out.push({ type: "hardBreak" });
        i++;
        continue;
      }
      if (BLOCK_TAGS.has(tk.name)) return out; // block boundary ends the run
      const mark = markFor(tk.name, tk.attrs);
      if (mark) {
        const nested = tk.name;
        i++; // consume open
        const inner = parseInline(
          nested,
          mark === "container" ? marks : withMark(marks, mark),
        );
        out.push(...inner);
        if (i < toks.length && toks[i]!.t === "close" && (toks[i] as { name: string }).name === nested)
          i++;
        continue;
      }
      i++; // unknown inline tag — drop the tag, keep going
    }
    return out;
  }

  function parseBlocks(stop: string | null): RichBlock[] {
    const out: RichBlock[] = [];
    while (i < toks.length) {
      const tk = toks[i]!;
      if (tk.t === "close") {
        if (stop && tk.name === stop) return out;
        i++;
        continue;
      }
      if (tk.t === "text") {
        const inline = parseInline("\0", []); // no stop tag — runs until a block/close
        if (inline.length) out.push({ type: "paragraph", content: inline });
        continue;
      }
      const name = tk.name;
      if (name === "p") {
        i++;
        const content = parseInline("p", []);
        if (i < toks.length && toks[i]!.t === "close" && (toks[i] as { name: string }).name === "p") i++;
        out.push(content.length ? { type: "paragraph", content } : { type: "paragraph" });
        continue;
      }
      if (name === "ul" || name === "ol") {
        i++;
        const items = parseList(name);
        if (i < toks.length && toks[i]!.t === "close" && (toks[i] as { name: string }).name === name) i++;
        out.push({
          type: name === "ul" ? "bulletList" : "orderedList",
          content: items,
        });
        continue;
      }
      if (name === "li") {
        i++; // stray <li> outside a list — drop the tag
        continue;
      }
      // inline tag or <br> at block level → gather a paragraph
      const inline = parseInline("\0", []);
      if (inline.length) out.push({ type: "paragraph", content: inline });
      else i++;
    }
    return out;
  }

  function parseList(listName: string): ListItem[] {
    const items: ListItem[] = [];
    while (i < toks.length) {
      const tk = toks[i]!;
      if (tk.t === "close" && tk.name === listName) return items;
      if (tk.t === "open" && tk.name === "li") {
        i++;
        const content = parseBlocks("li");
        if (i < toks.length && toks[i]!.t === "close" && (toks[i] as { name: string }).name === "li") i++;
        items.push({
          type: "listItem",
          content: content.length ? content : [{ type: "paragraph" }],
        });
        continue;
      }
      i++; // whitespace/text/other between items — drop
    }
    return items;
  }

  const content = parseBlocks(null);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function mkText(text: string, marks: RichMark[]): RichTextNode {
  return marks.length
    ? { type: "text", text, marks: [...marks] }
    : { type: "text", text };
}

// Legacy plain text → one paragraph; newlines become hard breaks, matching the
// old renderer's `\n` → <br> so seeded plain-text blocks render identically.
function plainParagraph(text: string): Paragraph {
  const content: RichInline[] = [];
  text.split(/\r?\n/).forEach((part, idx) => {
    if (idx > 0) content.push({ type: "hardBreak" });
    if (part) content.push({ type: "text", text: part });
  });
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

// Flatten a stored value to plain text — for the cover-page text block, which is
// authored as plain text (a tagline/date) and rendered as a string, and for any
// plain-text context. Strings pass through (tags stripped defensively); a doc's
// paragraphs join with newlines.
export function richTextToPlain(value: RichTextValue): string {
  if (typeof value === "string")
    return decodeEntities(value.replace(/<[^>]*>/g, ""));
  return value.content
    .map((block) => blockToPlain(block))
    .filter((s) => s !== "")
    .join("\n");
}

function blockToPlain(block: RichBlock): string {
  if (block.type === "paragraph")
    return (block.content ?? [])
      .map((n) => (n.type === "text" ? n.text : "\n"))
      .join("");
  return block.content
    .map((li) => li.content.map(blockToPlain).join("\n"))
    .join("\n");
}
