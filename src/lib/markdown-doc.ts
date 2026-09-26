// Markdown ⇄ rich-text doc for the editing assistant (#306): `docToMarkdown` is
// how the projection shows body text, `markdownToDoc` how the intent tools take
// it back (#310). Hand-rolled and lenient: the
// model's markdown is converted, never trusted — anything unrecognised stays as
// literal text, and the result is validated by the save path's `richDocSchema`.
//
// Dialect: blank line = new paragraph; a single newline inside a paragraph = a
// hard line break (keeps addresses and verse intact); `-`/`*`/`+` bullets and
// `1.` numbered lists, nested by indentation; **bold**, *italic*, <u>underline</u>,
// ~~strike~~, [links](url); backslash escapes. A `#` heading line becomes a bold
// paragraph and is reported, since headings are blocks of their own.
import {
  richDocSchema,
  type ListItem,
  type RichBlock,
  type RichDoc,
  type RichInline,
  type RichMark,
} from "./rich-text-doc";

export type MarkdownResult = { doc: RichDoc; notes: string[] };

const MAX_LIST_DEPTH = 4;
const BULLET = /^( *)([-*+])[ \t]+(.*)$/;
const ORDERED = /^( *)(\d{1,9})[.)][ \t]+(.*)$/;
const ATX = /^ {0,3}#{1,6}[ \t]+(.*?)[ \t#]*$/;

type Marker = { indent: number; ordered: boolean; text: string };

function marker(line: string): Marker | null {
  const b = BULLET.exec(line);
  if (b && !/^( *)([-*_])( *\2){2,} *$/.test(line))
    return { indent: b[1]!.length, ordered: false, text: b[3]! };
  const o = ORDERED.exec(line);
  if (o) return { indent: o[1]!.length, ordered: true, text: o[3]! };
  return null;
}

const indentOf = (line: string) => line.length - line.trimStart().length;
const isBlank = (line: string) => line.trim() === "";

/** Convert the model's markdown to a validated rich-text doc. Never throws. */
export function markdownToDoc(md: string): MarkdownResult {
  const notes: string[] = [];
  const lines = md.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
  const content = parseBlocks(lines, 0, notes);
  const parsed = richDocSchema.safeParse({ type: "doc", content });
  if (parsed.success) return { doc: parsed.data, notes };
  // Last resort: the text as plain paragraphs, which the schema always accepts
  // unless the text itself is over the size budget.
  notes.push("formatting could not be kept; saved as plain paragraphs");
  const plain = md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p): RichBlock => ({
        type: "paragraph",
        content: [{ type: "text", text: p }],
      }),
    );
  return { doc: richDocSchema.parse({ type: "doc", content: plain }), notes };
}

function parseBlocks(
  lines: string[],
  depth: number,
  notes: string[],
): RichBlock[] {
  const out: RichBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }
    const m = marker(line);
    if (m && depth < MAX_LIST_DEPTH) {
      const [list, next] = parseList(lines, i, m, depth, notes);
      out.push(list);
      i = next;
      continue;
    }
    const heading = ATX.exec(line);
    if (heading) {
      notes.push(
        `"${heading[1]}" was a markdown heading; it became a bold line (headings are separate blocks)`,
      );
      const inline = parseInline(heading[1]!, [{ type: "bold" }]);
      if (inline.length) out.push({ type: "paragraph", content: inline });
      i++;
      continue;
    }
    // A paragraph runs until a blank line or the start of a list.
    const para: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]!) &&
      !(para.length && marker(lines[i]!))
    ) {
      para.push(lines[i]!.trim());
      i++;
    }
    const inline = linesToInline(para);
    if (inline.length) out.push({ type: "paragraph", content: inline });
  }
  return out;
}

function parseList(
  lines: string[],
  start: number,
  first: Marker,
  depth: number,
  notes: string[],
): [RichBlock, number] {
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = marker(lines[i]!);
    if (!m || m.ordered !== first.ordered || m.indent !== first.indent) break;
    // The item's body: its first line, then every following line indented past
    // the marker (nested lists, extra paragraphs) or a lazy continuation line.
    const contentIndent = m.indent + 2;
    const body = [m.text];
    i++;
    while (i < lines.length) {
      const line = lines[i]!;
      if (isBlank(line)) {
        const nextIdx = lines.findIndex((l, k) => k > i && !isBlank(l));
        if (nextIdx === -1 || indentOf(lines[nextIdx]!) < contentIndent) break;
        body.push("");
        i++;
        continue;
      }
      const lm = marker(line);
      if (indentOf(line) >= contentIndent)
        body.push(line.slice(Math.min(indentOf(line), contentIndent)));
      else if (!lm && !isBlank(body[body.length - 1]!)) body.push(line.trim());
      else break;
      i++;
    }
    const content = parseBlocks(body, depth + 1, notes);
    items.push({
      type: "listItem",
      content: content.length ? content : [{ type: "paragraph" }],
    });
    // A blank line between items of the same list keeps the list going.
    while (i < lines.length && isBlank(lines[i]!)) {
      const nextIdx = lines.findIndex((l, k) => k > i && !isBlank(l));
      const nm = nextIdx === -1 ? null : marker(lines[nextIdx]!);
      if (nm && nm.ordered === first.ordered && nm.indent === first.indent)
        i = nextIdx;
      else break;
    }
  }
  return [
    { type: first.ordered ? "orderedList" : "bulletList", content: items },
    i,
  ];
}

function linesToInline(lines: string[]): RichInline[] {
  const out: RichInline[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push({ type: "hardBreak" });
    // A trailing backslash or two spaces is markdown's own hard break; the
    // newline already is one here, so just drop the marker.
    out.push(...parseInline(line.replace(/\\$/, ""), []));
  });
  return mergeRuns(out);
}

// --- Inline ------------------------------------------------------------------

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~<>|]/;

type Delim = {
  open: string;
  close: string;
  mark: RichMark | "link";
  wordBound?: boolean;
};
const DELIMS: Delim[] = [
  { open: "**", close: "**", mark: { type: "bold" } },
  { open: "__", close: "__", mark: { type: "bold" }, wordBound: true },
  { open: "~~", close: "~~", mark: { type: "strike" } },
  { open: "<u>", close: "</u>", mark: { type: "underline" } },
  { open: "*", close: "*", mark: { type: "italic" } },
  { open: "_", close: "_", mark: { type: "italic" }, wordBound: true },
];

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Index of the closing delimiter, skipping escapes and nested `**` spans. */
function findClose(s: string, from: number, d: Delim): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (d.open === "*" && s.startsWith("**", j)) {
      // A bold span inside italic: jump over it whole.
      const end = findClose(s, j + 3, DELIMS[0]!);
      if (end !== -1 && s[end + 2] !== "*") {
        j = end + 1;
        continue;
      }
      // `***` closing both: the italic closes on the last star.
      if (s.startsWith("***", j)) return j + 2;
    }
    if (!s.startsWith(d.close, j)) continue;
    if (d.wordBound && isWord(s[j + d.close.length])) continue;
    // `**x***`: the run of three ends bold on its last two stars.
    if (d.close === "**" && s[j + 2] === "*") return j + 1;
    return j;
  }
  return -1;
}

function withMark(marks: RichMark[], mark: RichMark): RichMark[] {
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark];
}

export function parseInline(s: string, marks: RichMark[]): RichInline[] {
  const out: RichInline[] = [];
  let buf = "";
  const flush = () => {
    if (buf)
      out.push(
        marks.length
          ? { type: "text", text: buf, marks: [...marks] }
          : { type: "text", text: buf },
      );
    buf = "";
  };
  let i = 0;
  outer: while (i < s.length) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length && ESCAPABLE.test(s[i + 1]!)) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (c === "[") {
      const link = parseLink(s, i);
      if (link) {
        flush();
        out.push(
          ...parseInline(
            link.text,
            withMark(marks, { type: "link", attrs: { href: link.href } }),
          ),
        );
        i = link.end;
        continue;
      }
    }
    for (const d of DELIMS) {
      if (!s.startsWith(d.open, i)) continue;
      if (d.wordBound && isWord(s[i - 1])) continue;
      const inner = i + d.open.length;
      if (s[inner] === " " || inner >= s.length) continue;
      const close = findClose(s, inner + 1, d);
      if (close === -1) continue;
      flush();
      out.push(
        ...parseInline(
          s.slice(inner, close),
          withMark(marks, d.mark as RichMark),
        ),
      );
      i = close + d.close.length;
      continue outer;
    }
    buf += c;
    i++;
  }
  flush();
  return mergeRuns(out);
}

function parseLink(
  s: string,
  at: number,
): { text: string; href: string; end: number } | null {
  let depth = 0;
  for (let j = at; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === "[") depth++;
    else if (s[j] === "]" && --depth === 0) {
      if (s[j + 1] !== "(") return null;
      const close = s.indexOf(")", j + 2);
      if (close === -1) return null;
      const href = s
        .slice(j + 2, close)
        .trim()
        .replace(/^<|>$/g, "");
      if (!href || /\s/.test(href)) return null;
      return { text: s.slice(at + 1, j), href, end: close + 1 };
    }
  }
  return null;
}

const markKey = (marks: RichMark[] | undefined) =>
  (marks ?? [])
    .map((m) => (m.type === "link" ? `link:${m.attrs.href}` : m.type))
    .sort()
    .join("|");

/** Join adjacent text runs carrying identical marks (Tiptap does the same). */
function mergeRuns(nodes: RichInline[]): RichInline[] {
  const out: RichInline[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (
      n.type === "text" &&
      last?.type === "text" &&
      markKey(last.marks) === markKey(n.marks)
    )
      out[out.length - 1] = { ...last, text: last.text + n.text };
    else out.push(n);
  }
  return out;
}

// --- Doc → markdown ------------------------------------------------------------

const ORDER = ["bold", "italic", "underline", "strike"] as const;
const OPEN: Record<(typeof ORDER)[number], [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["<u>", "</u>"],
  strike: ["~~", "~~"],
};

function escapeText(text: string): string {
  return text
    .replace(/[\\*_[\]~]/g, (c) => `\\${c}`)
    .replace(/<(\/?u>)/gi, "\\<$1");
}

/** Escape what would read as block syntax at the start of a line. */
function escapeLineStart(line: string): string {
  return line
    .replace(/^(\s*)([-+#>])(?=\s|$)/, "$1\\$2")
    .replace(/^(\s*\d+)([.)])(?=\s)/, "$1\\$2");
}

function linkOf(n: RichInline): string | undefined {
  if (n.type !== "text") return undefined;
  const link = n.marks?.find((m) => m.type === "link");
  return link?.type === "link" ? link.attrs.href : undefined;
}

function inlineToMarkdown(nodes: RichInline[]): string {
  let out = "";
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i]!;
    const href = linkOf(n);
    // A link spans every consecutive run sharing its href; unlinked runs group
    // too, so emphasis crossing run boundaries stays well nested.
    let j = i + 1;
    while (j < nodes.length && linkOf(nodes[j]!) === href) j++;
    const body = styledRuns(nodes.slice(i, j));
    out += href ? `[${body}](${href})` : body;
    i = j;
  }
  return out;
}

/** Well-nested emphasis over a run of nodes: a stack of open marks. */
function styledRuns(nodes: RichInline[]): string {
  let out = "";
  const stack: (typeof ORDER)[number][] = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") {
      while (stack.length) out += OPEN[stack.pop()!][1];
      out += "\n";
      continue;
    }
    const want = ORDER.filter((t) => n.marks?.some((m) => m.type === t));
    let keep = 0;
    while (keep < stack.length && want.includes(stack[keep]!)) keep++;
    while (stack.length > keep) out += OPEN[stack.pop()!][1];
    for (const t of want)
      if (!stack.includes(t)) {
        out += OPEN[t][0];
        stack.push(t);
      }
    out += escapeText(n.text);
  }
  while (stack.length) out += OPEN[stack.pop()!][1];
  return out;
}

function blockToMarkdown(block: RichBlock): string {
  if (block.type === "paragraph")
    return inlineToMarkdown(block.content ?? [])
      .split("\n")
      .map(escapeLineStart)
      .join("\n");
  return block.content
    .map((item, idx) => {
      const prefix = block.type === "bulletList" ? "- " : `${idx + 1}. `;
      const pad = " ".repeat(prefix.length);
      const body = item.content
        .map(
          (b, k) =>
            (k === 0 ? "" : b.type === "paragraph" ? "\n\n" : "\n") +
            blockToMarkdown(b),
        )
        .join("");
      return body
        .split("\n")
        .map((l, k) => (k === 0 ? prefix + l : l ? pad + l : l))
        .join("\n");
    })
    .join("\n");
}

/** The projection's view of a text block. Empty paragraphs are dropped. */
export function docToMarkdown(doc: RichDoc): string {
  return doc.content
    .filter((b) => b.type !== "paragraph" || (b.content?.length ?? 0) > 0)
    .map(blockToMarkdown)
    .join("\n\n");
}
