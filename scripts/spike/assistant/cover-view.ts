// The cover in the projection, when the run offers cover tools: its background,
// masthead and items with their ids, the interior headings a story may link,
// and (style tier) the grid, palette and fonts the model may use.
import type { Block, Page } from "../../../src/lib/blocks.ts";
import type { CoverAppearance } from "../../../src/lib/cover-appearance.ts";
import {
  coverSources,
  type CoverElement,
  type CoverPlacement,
} from "../../../src/lib/cover-elements.ts";
import { richTextToPlain } from "../../../src/lib/rich-text-doc.ts";
import type { IssueContext } from "./seed.ts";

const q = (s: string) => `"${s.replace(/\n/g, " / ")}"`;
const isBackground = (b: Block) =>
  b.type === "image" && (b.align === "page-fill" || b.align === "page-fit");

function paint(a?: CoverAppearance): string {
  if (!a) return "";
  const parts = Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} ${v}`);
  return parts.length ? ` · ${parts.join(", ")}` : "";
}

function where(p?: CoverPlacement): string {
  if (!p) return "default place";
  return `${p.row} ${p.column}, ${p.width}, align ${p.align}${p.textSize ? `, ${p.textSize} type` : ""}${p.order !== undefined ? `, order ${p.order}` : ""}${paint(p.appearance)}`;
}

function lettering(p?: CoverPlacement): string {
  const doc = p?.richText && Object.values(p.richText)[0];
  const mark = doc?.content[0]?.content
    ?.find((n) => n.type === "text")
    ?.marks?.find((m) => m.type === "coverPaint");
  const attrs = mark && "attrs" in mark ? mark.attrs : undefined;
  return attrs?.fontFamily
    ? ` · lettering ${attrs.fontFamily}${attrs.fontWeight ? ` ${attrs.fontWeight}` : ""}`
    : "";
}

function element(el: CoverElement, ctx: IssueContext): string {
  const head = `[${el.id}]`;
  if (el.type === "details")
    return `${head} details ${q(el.text)} · issue number ${el.showNumber ? "shown" : "hidden"} · ${where(el.placement)}${lettering(el.placement)}`;
  if (el.type === "logo") {
    const name = ctx.logos.find((l) => l.id === el.logoId)?.name ?? el.alt;
    return `${head} logo ${q(name)} · size ${el.size} · ${where(el.placement)}`;
  }
  const sources = coverSources(ctx.content.pages);
  const font =
    el.headlineFont || el.headlineWeight
      ? ` · headline ${el.headlineFont ?? "newsreader"} ${el.headlineWeight ?? ""}`.trimEnd()
      : "";
  const items = el.items.map((it, i) => {
    const src = sources.find((s) => s.id === it.headingId);
    const link = src
      ? `→ [${src.id}] ${q(src.title)} (p${src.pageNo})`
      : it.headingId
        ? "→ (missing heading)"
        : "(free-standing)";
    return `    ${i + 1}. ${link}${it.title ? ` as ${q(it.title)}` : ""}${it.description ? ` — ${q(it.description)}` : ""}`;
  });
  return [
    `${head} story${el.title ? ` ${q(el.title)}` : ""} · ${el.headlineSize}${font} · page numbers ${el.showPageNumbers ? "shown" : "hidden"} · ${where(el.placement)}`,
    ...items,
  ].join("\n");
}

export function coverView(
  ctx: IssueContext,
  pageNo: number,
  page: Page,
): string {
  const style = ctx.coverTools === "style";
  const bg = page.blocks.find(isBackground);
  const masthead = page.blocks.find((b) => b.type === "heading");
  const others = page.blocks.filter((b) => b !== bg && b !== masthead);
  const o = page.coverOverlay;
  const lines = [
    `PAGE ${pageNo} — the cover`,
    `Background: ${bg && bg.type === "image" ? `[${bg.id}] ${bg.imageId} · ${bg.align === "page-fill" ? "fill" : "fit"}` : "none"}`,
    `Masthead: ${masthead && masthead.type === "heading" ? `[${masthead.id}] ${q(masthead.title)}${masthead.kicker ? ` · kicker ${q(masthead.kicker)}` : ""} · ${where(masthead.coverPlacement)}${lettering(masthead.coverPlacement)}` : "none"}`,
    ...others.map(
      (b) =>
        `Other cover block: [${b.id}] ${b.type}${b.type === "text" ? ` ${q(richTextToPlain(b.text))}` : b.type === "image" ? ` ${b.imageId ?? "(empty)"}` : ""} · ${where((b as { coverPlacement?: CoverPlacement }).coverPlacement)}`,
    ),
    `Cover items: ${page.coverElements?.length ? "" : "none"}`,
    ...(page.coverElements ?? []).map((el) => element(el, ctx)),
    `Cover defaults: automatic magazine-name line ${o?.masthead === false ? "off" : "on"}, frame ${o?.decoration === false || (o?.decoration === undefined && bg) ? "off" : "on"}${paint(o?.appearance)}`,
    `Interior headings a story can link: ${
      coverSources(ctx.content.pages)
        .slice(0, 40)
        .map((s) => `[${s.id}] p${s.pageNo} ${q(s.title)}`)
        .join("; ") || "none yet"
    }`,
  ];
  if (style)
    lines.push(
      "Cover grid: column left|center|right × row top|center|bottom; width narrow|medium|wide; align left|center|right; text size small|normal|large|xlarge.",
      "Colours: paper, ink, green, blue, sage, stone, or any #rrggbb. Fonts: newsreader 200–800, hanken-grotesk 100–900, roboto-condensed 100–900.",
    );
  return lines.join("\n");
}

/** "a background, a masthead, 2 stories, details and a logo" — for tool results. */
export function coverSummary(ctx: IssueContext): string {
  const page = ctx.content.pages.find((p) => p.cover);
  if (!page) return "nothing";
  const els = page.coverElements ?? [];
  const n = (type: CoverElement["type"]) =>
    els.filter((e) => e.type === type).length;
  const parts = [
    page.blocks.some(isBackground) && "a background photo",
    page.blocks.some((b) => b.type === "heading") && "a masthead",
    n("story") && `${n("story")} stor${n("story") > 1 ? "ies" : "y"}`,
    n("details") && "issue details",
    n("logo") && `${n("logo")} logo${n("logo") > 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "nothing on it";
}
