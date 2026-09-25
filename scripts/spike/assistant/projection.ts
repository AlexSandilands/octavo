// The plain-text view of the issue the model reads (#306 "What it reads", #309).
// Never JSON: a header, an outline of every page with its (estimated) fill, and
// one page in full with every block's id. Bounded: long text is cut with `[…]`.
import type { Block, Page } from "../../../src/lib/blocks.ts";
import { richTextToPlain } from "../../../src/lib/rich-text-doc.ts";
import { blockPlain, describeFill, estimateFill, textDoc } from "./fill.ts";
import { docToMarkdown } from "./markdown.ts";
import { placedImageIds, type ImageInfo, type IssueContext } from "./seed.ts";

/** Per-block text cap in the current-page view; `read_page` allows more. */
export const VIEW_TEXT_CAP = 2_500;
export const READ_TEXT_CAP = 12_000;
const OUTLINE_LABEL = 60;
export const PROJECTION_MAX = 60_000; // the route's projection limit (#308)

const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n).trimEnd()} […]` : s;
const quote = (s: string) => `"${s.replace(/\s+/g, " ").trim()}"`;

export function shape(info: ImageInfo | undefined): string {
  if (!info) return "shape unknown";
  const r = info.width / info.height;
  const kind = r > 1.1 ? "landscape" : r < 0.9 ? "portrait" : "square";
  return `${kind} ${info.width}×${info.height}`;
}

function pageLabel(page: Page): string {
  const heading = page.blocks.find(
    (b) => b.type === "heading" && b.title.trim(),
  );
  if (heading && heading.type === "heading")
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
  ctx: IssueContext,
  textCap: number,
  cover: boolean,
): string {
  const head = `[${block.id}]`;
  switch (block.type) {
    case "heading": {
      const kicker = block.kicker.trim()
        ? ` · kicker ${quote(block.kicker)}`
        : "";
      return `${head} heading ${cover ? "(cover)" : (block.level ?? "main")}${kicker} · ${quote(block.title)}`;
    }
    case "text": {
      if (cover)
        return `${head} text (cover) · ${quote(clip(richTextToPlain(block.text), 200))}`;
      const md = clip(docToMarkdown(textDoc(block)), textCap);
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
        ? `${block.imageId} (${shape(ctx.images.get(block.imageId))})`
        : "no photo yet";
      const layout =
        block.align === "page-fill" || block.align === "page-fit"
          ? `${block.align} (owns the page)`
          : `${block.align} ${block.width}%`;
      const caption = block.caption.trim()
        ? ` · caption ${quote(block.caption)}`
        : "";
      const alt = block.alt?.trim()
        ? ` · alt ${quote(block.alt)}`
        : " · no alt text";
      return `${head} image ${img} · ${layout}${caption}${alt}`;
    }
    case "montage":
      return `${head} slideshow of ${block.items.length} photos · ${block.align} ${block.width}% (move/delete only)`;
    case "video":
      return `${head} video · ${block.align} ${block.width}% (move/delete only)`;
    case "sponsor":
      return `${head} sponsor ${quote(block.name)} (move/delete only)`;
  }
}

/** One page in full: every block with its id, text as markdown. */
export function pageView(
  ctx: IssueContext,
  pageNo: number,
  textCap = READ_TEXT_CAP,
): string {
  const page = ctx.content.pages[pageNo - 1];
  if (!page)
    return `There is no page ${pageNo}; the issue has ${ctx.content.pages.length} pages.`;
  const fill = describeFill(estimateFill(page, ctx.images));
  const title = page.cover
    ? `PAGE ${pageNo} — the cover (cover editing isn't available)`
    : `PAGE ${pageNo} — ${fill} (estimate)`;
  const blocks = page.blocks.map((b) =>
    describeBlock(b, ctx, textCap, !!page.cover),
  );
  return [title, ...(blocks.length ? blocks : ["(empty page)"])].join("\n");
}

export function outline(ctx: IssueContext): string {
  return ctx.content.pages
    .map((page, i) => {
      const n = `p${i + 1}`.padEnd(4);
      if (page.cover) return `${n} cover`;
      const fill = describeFill(estimateFill(page, ctx.images));
      return `${n} ${pageLabel(page)} · ${blockKinds(page)} · ${fill}`;
    })
    .join("\n");
}

export function header(ctx: IssueContext): string {
  const placed = placedImageIds(ctx.content);
  const unplaced = ctx.uploads.filter((u) => !placed.has(u.id));
  return [
    `ISSUE ${quote(ctx.title)} · draft · theme ${ctx.theme} · ${ctx.content.pages.length} pages`,
    `Photos uploaded but not placed: ${unplaced.length ? unplaced.map((u) => `${u.id} (${shape(u)})`).join(", ") : "none"}`,
    `Logos: ${ctx.logoNames.join("; ") || "none"}`,
    `Sponsors: ${ctx.sponsorNames.join("; ") || "none"}`,
  ].join("\n");
}

/** The whole projection sent with each message: header, outline, current page. */
export function projection(ctx: IssueContext, currentPage: number): string {
  const text = [
    header(ctx),
    "",
    "OUTLINE (fill figures are estimates)",
    outline(ctx),
    "",
    `CURRENT ${pageView(ctx, currentPage, VIEW_TEXT_CAP)}`,
  ].join("\n");
  return clip(text, PROJECTION_MAX);
}
