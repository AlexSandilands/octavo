// The cover in the projection (#309): its background, masthead and items with
// their ids. With cover tools (#313) it also lists the interior headings a story
// may link and, in the style tier, the grid and palette the model may use.
import type { Block, Page } from "@/lib/blocks";
import type { CoverAppearance } from "@/lib/cover-appearance";
import {
  coverSources,
  type CoverElement,
  type CoverPlacement,
} from "@/lib/cover-elements";
import { richTextToPlain } from "@/lib/rich-text-doc";
import type { AssistantIssue } from "./issue-context";
import { clip, shape } from "./projection-text";

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

function element(el: CoverElement, ctx: AssistantIssue): string {
  const head = `[${el.id}]`;
  if (el.type === "details")
    return `${head} details ${q(el.text)} · issue number ${el.showNumber ? "shown" : "hidden"} · ${where(el.placement)}${lettering(el.placement)}`;
  if (el.type === "logo") {
    const name = ctx.logos.find((l) => l.id === el.logoId)?.name ?? el.alt;
    return `${head} logo ${q(name)} · size ${el.size} · ${where(el.placement)}`;
  }
  const sources = coverSources(ctx.pages);
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
  ctx: AssistantIssue,
  pageNo: number,
  page: Page,
): string {
  const style = ctx.coverTools === "style";
  const photo = (id: string) => `${id} (${shape(ctx.images[id])})`;
  const bg = page.blocks.find(isBackground);
  const masthead = page.blocks.find((b) => b.type === "heading");
  const others = page.blocks.filter((b) => b !== bg && b !== masthead);
  const o = page.coverOverlay;
  const lines = [
    `PAGE ${pageNo} — the cover${ctx.coverTools ? "" : " (cover editing isn't available)"}`,
    `Background: ${bg && bg.type === "image" ? `[${bg.id}] ${bg.imageId ? photo(bg.imageId) : "(no photo yet)"} · ${bg.align === "page-fill" ? "fill" : "fit"}` : "none"}`,
    `Masthead: ${masthead && masthead.type === "heading" ? `[${masthead.id}] ${q(masthead.title)}${masthead.kicker ? ` · kicker ${q(masthead.kicker)}` : ""} · ${where(masthead.coverPlacement)}${lettering(masthead.coverPlacement)}` : "none"}`,
    ...others.map(
      (b) =>
        `Other cover block: [${b.id}] ${b.type}${b.type === "text" ? ` ${q(clip(richTextToPlain(b.text), 200))}` : b.type === "image" ? ` ${b.imageId ? photo(b.imageId) : "(no photo yet)"}` : ""} · ${where((b as { coverPlacement?: CoverPlacement }).coverPlacement)}`,
    ),
    `Cover items: ${page.coverElements?.length ? "" : "none"}`,
    ...(page.coverElements ?? []).map((el) => element(el, ctx)),
    `Cover defaults: automatic magazine-name line ${o?.masthead === false ? "off" : "on"}, frame ${o?.decoration === false || (o?.decoration === undefined && bg) ? "off" : "on"}${paint(o?.appearance)}`,
  ];
  if (ctx.coverTools)
    lines.push(
      `Interior headings a story can link: ${
        coverSources(ctx.pages)
          .slice(0, 40)
          .map((s) => `[${s.id}] p${s.pageNo} ${q(s.title)}`)
          .join("; ") || "none yet"
      }`,
    );
  if (style)
    lines.push(
      "Cover grid: column left|center|right × row top|center|bottom; width narrow|medium|wide; align left|center|right; text size small|normal|large|xlarge.",
      "Colours: paper, ink, green, blue, sage, stone, or any #rrggbb.",
    );
  return lines.join("\n");
}
