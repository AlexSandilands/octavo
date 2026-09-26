// The plain-text view of the issue the assistant reads (#306 "What the model
// reads", #309). Never JSON: a header, an outline of every page with its
// measured fill, and one page in full with every block's id. Pure, so the check
// script runs it over the seed. Bounded: long text is cut with `[…]`, which the
// prompt explains.
import { AI_MAX_PROJECTION_CHARS } from "@/lib/ai-chat-contract";
import type { Block, Page } from "@/lib/blocks";
import { collectImageIds } from "@/lib/images";
import { docToMarkdown } from "@/lib/markdown-doc";
import { richTextToPlain, stringToDoc } from "@/lib/rich-text-doc";
import { coverView } from "./cover-view";
import type { AssistantIssue } from "./issue-context";
import { describeFill } from "./page-fill";
import { clip, quote, shape } from "./projection-text";

/** The route's limit on a projection or a `read_page` result (#308). */
export const PROJECTION_MAX = AI_MAX_PROJECTION_CHARS;
/** Per-block text cap in the current-page view; `read_page` allows more. */
export const VIEW_TEXT_CAP = 2_500;
export const READ_TEXT_CAP = 12_000;
const OUTLINE_LABEL = 60;
/** The outline stops listing pages past this share of the projection. */
const OUTLINE_MAX = 24_000;
const HEADER_LIST_MAX = 3_000;

function blockPlain(block: Block): string {
  if (block.type === "heading")
    return [block.kicker, block.title].filter(Boolean).join(" ");
  return block.type === "text" ? richTextToPlain(block.text) : "";
}

function pageLabel(page: Page): string {
  const heading = page.blocks.find(
    (b) => b.type === "heading" && b.title.trim(),
  );
  if (heading?.type === "heading")
    return quote(clip(heading.title, OUTLINE_LABEL));
  const text = page.blocks.map(blockPlain).find((t) => t.trim());
  return text ? `(no heading) ${quote(clip(text, 40))}` : "(no heading)";
}

function blockKinds(page: Page): string {
  const counts = new Map<string, number>();
  for (const b of page.blocks)
    counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  return (
    [...counts].map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`).join(", ") ||
    "empty"
  );
}

function describeBlock(
  block: Block,
  issue: AssistantIssue,
  textCap: number,
): string {
  const head = `[${block.id}]`;
  switch (block.type) {
    case "heading": {
      const kicker = block.kicker.trim()
        ? ` · kicker ${quote(clip(block.kicker, 200))}`
        : "";
      return `${head} heading ${block.level ?? "main"}${kicker} · ${quote(clip(block.title, 500))}`;
    }
    case "text": {
      const doc =
        typeof block.text === "string" ? stringToDoc(block.text) : block.text;
      const md = clip(docToMarkdown(doc), textCap);
      const opts = [
        block.size && block.size !== "m" ? `size ${block.size}` : "",
        block.align ? `align ${block.align}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const body = md
        ? md
            .split("\n")
            .map((l) => `    ${l}`)
            .join("\n")
        : "    (empty)";
      return `${head} text${opts ? ` · ${opts}` : ""}\n${body}`;
    }
    case "image": {
      const img = block.imageId
        ? `${block.imageId} (${shape(issue.images[block.imageId])})`
        : "no photo yet";
      const layout =
        block.align === "page-fill" || block.align === "page-fit"
          ? `${block.align} (owns the page)`
          : `${block.align} ${block.width}%`;
      const caption = block.caption.trim()
        ? ` · caption ${quote(clip(block.caption, 300))}`
        : "";
      const alt = block.alt?.trim()
        ? ` · alt ${quote(clip(block.alt, 300))}`
        : " · no alt text";
      return `${head} image ${img} · ${layout}${caption}${alt}`;
    }
    case "montage":
      return `${head} slideshow of ${block.items.length} photos · ${block.align} ${block.width}% (move/delete only)`;
    case "video":
      return `${head} video · ${block.align} ${block.width}% (move/delete only)`;
    case "sponsor":
      return `${head} sponsor ${quote(clip(block.name, 100))} (move/delete only)`;
  }
}

/** One page in full: every block with its id, text as markdown. */
export function pageView(
  issue: AssistantIssue,
  pageNo: number,
  textCap = READ_TEXT_CAP,
): string {
  const page = issue.pages[pageNo - 1];
  if (!page)
    return `There is no page ${pageNo}; this issue has ${issue.pages.length} pages.`;
  const text = page.cover
    ? coverView(issue, pageNo, page)
    : [
        `PAGE ${pageNo} — ${describeFill(issue.fills[page.id])}`,
        ...(page.blocks.length
          ? page.blocks.map((b) => describeBlock(b, issue, textCap))
          : ["(empty page)"]),
      ].join("\n");
  return clip(text, PROJECTION_MAX);
}

export function outline(issue: AssistantIssue): string {
  const lines: string[] = [];
  let length = 0;
  for (const [i, page] of issue.pages.entries()) {
    const n = `p${i + 1}`.padEnd(4);
    const line = page.cover
      ? `${n} cover`
      : `${n} ${pageLabel(page)} · ${blockKinds(page)} · ${describeFill(issue.fills[page.id])}`;
    if (length + line.length > OUTLINE_MAX) {
      lines.push(
        `[…] pages ${i + 1}–${issue.pages.length} not listed; read_page shows any page`,
      );
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join("\n");
}

export function header(issue: AssistantIssue): string {
  const placed = new Set(collectImageIds(issue));
  const unplaced = issue.uploads.filter((id) => !placed.has(id));
  const list = (items: string[]) =>
    items.length ? clip(items.join("; "), HEADER_LIST_MAX) : "none";
  return [
    `ISSUE ${quote(clip(issue.title, 200))} · draft · theme ${issue.theme} · ${issue.pages.length} pages`,
    `Photos uploaded but not placed: ${list(unplaced.map((id) => `${id} (${shape(issue.images[id])})`))}`,
    `Logos in the library: ${list(issue.logos.map((l) => quote(l.name)))}`,
    `Sponsors: ${list(issue.sponsorNames.map(quote))}`,
  ].join("\n");
}

/** The whole projection sent with each author message: header, outline, current page. */
export function projection(issue: AssistantIssue, currentPage: number): string {
  const top = [
    header(issue),
    "",
    "OUTLINE",
    outline(issue),
    "",
    "CURRENT ",
  ].join("\n");
  // The current page gets whatever room the header and outline leave.
  return (
    top +
    clip(
      pageView(issue, currentPage, VIEW_TEXT_CAP),
      PROJECTION_MAX - top.length,
    )
  );
}
