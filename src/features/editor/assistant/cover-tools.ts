import { makeBlock, type Block, type Page } from "@/lib/blocks";
import {
  AI_COVER_ITEM_TOOLS,
  aiCoverToolSchemas as schemas,
  type AiCoverToolName,
} from "@/lib/ai-cover-tools";
import type { CoverAppearance } from "@/lib/cover-appearance";
import {
  MAX_COVER_ELEMENTS,
  coverElementSchema,
  coverPlacementSchema,
  coverSources,
  makeCoverElement,
  makeCoverStory,
  type CoverElement,
  type CoverPlacement,
} from "@/lib/cover-elements";
import { coverItems, placementOf } from "@/lib/cover-order";
import { setCoverBackground } from "../cover-layout";
import { Refusal, type EditResult } from "./edit-tools";
import type { EditMeasurer } from "./page-report";

// The assistant's cover edits (#313), lifted from the spike's cover-tools.ts:
// a background, a masthead, stories linked to real headings, issue details and
// a logo, each placed and painted on the cover's grid, through the real cover
// schemas. The compose tools act on the cover open now, else the front cover;
// the item tools find their id and refuse one that isn't on a cover. Every
// result ends with what the cover now holds and its layout warnings in words.

const refuse = (message: string): never => {
  throw new Refusal(message);
};

export type CoverContext = {
  pages: Page[];
  /** The page open now: a cover here is the one the compose tools edit. */
  curPage: number;
  /** Photos uploaded to this issue: the only ones a background can use. */
  photos: ReadonlySet<string>;
  logos: readonly { id: string; name: string; imageId: string }[];
  measure: EditMeasurer;
};

const isBackground = (b: Block) =>
  b.type === "image" && (b.align === "page-fill" || b.align === "page-fit");
const compact = <T extends object>(o: T) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>;

/** The cover the compose tools edit: the one open now, else the front cover. */
function targetCover(ctx: CoverContext): number {
  if (ctx.pages[ctx.curPage]?.cover) return ctx.curPage;
  return ctx.pages[0]?.cover ? 0 : refuse("this issue has no cover page");
}

type Item =
  | { kind: "element"; el: CoverElement; index: number }
  | { kind: "block"; block: Block; index: number };

/** An item by id on any cover; one on an interior page is refused. */
function findItem(pages: Page[], id: string): { pageIdx: number; item: Item } {
  for (const [pageIdx, page] of pages.entries()) {
    const el = (page.coverElements ?? []).findIndex((e) => e.id === id);
    const b = page.blocks.findIndex((x) => x.id === id);
    if (el === -1 && b === -1) continue;
    if (!page.cover)
      refuse(
        `[${id}] is on page ${pageIdx + 1}, which isn't a cover; cover tools only edit covers, so use the page tools for it`,
      );
    return {
      pageIdx,
      item:
        el !== -1
          ? { kind: "element", el: page.coverElements![el]!, index: el }
          : { kind: "block", block: page.blocks[b]!, index: b },
    };
  }
  return refuse(
    `no cover item has id "${id}"; use an id from the projection's cover section`,
  );
}

/** A new element, validated, after everything already on the cover. */
function addElement(page: Page, el: CoverElement): Page {
  if ((page.coverElements?.length ?? 0) >= MAX_COVER_ELEMENTS)
    refuse(`the cover already holds ${MAX_COVER_ELEMENTS} items`);
  const order = Math.max(
    0,
    ...coverItems(page).map((i) => (placementOf(i, page).order ?? 0) + 1),
  );
  const parsed = coverElementSchema.safeParse({
    ...el,
    placement: { ...el.placement, order },
  });
  if (!parsed.success)
    refuse(`that item isn't valid: ${parsed.error.issues[0]?.message}`);
  return {
    ...page,
    coverElements: [...(page.coverElements ?? []), parsed.data!],
  };
}

const overlayOf = (page: Page) => ({
  style: "light-shadow" as const,
  position: "top" as const,
  ...page.coverOverlay,
});

/** The item's placement with `change`, validated; a background can't be placed. */
function withPlacement(
  page: Page,
  item: Item,
  change: (p: CoverPlacement) => CoverPlacement,
): Page {
  if (item.kind === "block" && isBackground(item.block))
    refuse("the background fills the page; it can't be placed or styled");
  const current =
    item.kind === "element" ? item.el.placement : placementOf(item.block, page);
  const placement = coverPlacementSchema.parse(change(current));
  if (item.kind === "element")
    return {
      ...page,
      coverElements: page.coverElements!.map((e, i) =>
        i === item.index ? { ...e, placement } : e,
      ),
    };
  return {
    ...page,
    blocks: page.blocks.map((b, i) =>
      i === item.index ? ({ ...b, coverPlacement: placement } as Block) : b,
    ),
  };
}

function compose(
  ctx: CoverContext,
  name: AiCoverToolName,
  input: unknown,
  page: Page,
): { page: Page; text: string } {
  switch (name) {
    case "set_cover_background": {
      const a = schemas.set_cover_background.parse(input);
      const align = a.fit === "fill" ? "page-fill" : "page-fit";
      const placed = page.blocks.find(
        (b) => b.type === "image" && b.imageId === a.imageId,
      );
      if (!placed && !ctx.photos.has(a.imageId))
        refuse(`"${a.imageId}" isn't a photo uploaded to this issue`);
      // A former background stays on the cover as an ordinary photo.
      const block =
        placed ??
        ({
          ...makeBlock("image"),
          imageId: a.imageId,
          align,
          width: 100,
          caption: "",
          alt: a.alt ?? "",
        } as Block);
      const next = setCoverBackground(
        { ...page, blocks: placed ? page.blocks : [block, ...page.blocks] },
        block.id,
        align,
      );
      return {
        page:
          a.alt === undefined
            ? next
            : {
                ...next,
                blocks: next.blocks.map((b) =>
                  b.id === block.id ? ({ ...b, alt: a.alt } as Block) : b,
                ),
              },
        text: `Set the background to ${a.imageId} (${a.fit}).`,
      };
    }
    case "clear_cover_background": {
      schemas.clear_cover_background.parse(input);
      if (!page.blocks.some(isBackground))
        refuse("the cover has no background photo");
      return {
        page: { ...page, blocks: page.blocks.filter((b) => !isBackground(b)) },
        text: "Removed the background; the photo is unplaced again.",
      };
    }
    case "set_masthead": {
      const a = schemas.set_masthead.parse(input);
      const at = page.blocks.findIndex((b) => b.type === "heading");
      const blocks = [...page.blocks];
      if (at !== -1) {
        const old = blocks[at] as Extract<Block, { type: "heading" }>;
        // Lettering painted onto the old words doesn't carry to new ones.
        blocks[at] = {
          ...old,
          title: a.title,
          kicker: a.kicker ?? old.kicker,
          coverPlacement: old.coverPlacement && {
            ...old.coverPlacement,
            richText: undefined,
          },
        };
      } else
        blocks.push({
          ...makeBlock("heading"),
          title: a.title,
          kicker: a.kicker ?? "",
          coverPlacement: {
            ...makeCoverElement("details").placement,
            column: "left",
            row: "top",
            width: "wide",
            align: "left",
            textSize: "xlarge",
            order: 0,
          },
        } as Block);
      // The cover's own masthead replaces the automatic magazine-name line.
      return {
        page: {
          ...page,
          blocks,
          coverOverlay: { ...overlayOf(page), masthead: false },
        },
        text: `Set the masthead to "${a.title}".`,
      };
    }
    case "add_story": {
      const a = schemas.add_story.parse(input);
      const sources = coverSources(ctx.pages);
      for (const it of a.items) {
        if (!it.headingId && !it.title?.trim())
          refuse("each story needs a headingId or a title");
        if (it.headingId && !sources.some((s) => s.id === it.headingId))
          refuse(
            `"${it.headingId}" isn't an interior heading; link stories to heading ids from the list`,
          );
      }
      const el = makeCoverElement("story");
      const next = addElement(page, {
        ...el,
        type: "story",
        title: a.title ?? "",
        headlineSize: a.headlineSize ?? "list",
        showPageNumbers: a.showPageNumbers ?? a.items.some((i) => i.headingId),
        items: a.items.map((i) => ({
          ...makeCoverStory(i.headingId),
          title: i.title ?? "",
          description: i.description ?? "",
        })),
      });
      const n = a.items.length;
      return {
        page: next,
        text: `Added a story [${el.id}] with ${n} item${n > 1 ? "s" : ""}.`,
      };
    }
    case "add_details": {
      const a = schemas.add_details.parse(input);
      const el = makeCoverElement("details");
      return {
        page: addElement(page, {
          ...el,
          type: "details",
          text: a.text,
          showNumber: a.showNumber ?? true,
        }),
        text: `Added issue details [${el.id}].`,
      };
    }
    case "add_logo": {
      const a = schemas.add_logo.parse(input);
      const want = a.logo.trim().toLowerCase();
      const logo =
        ctx.logos.find((l) => l.name.toLowerCase() === want) ??
        refuse(
          `no logo is called "${a.logo}"; use a name from the logo library`,
        );
      const el = makeCoverElement("logo");
      return {
        page: addElement(page, {
          ...el,
          type: "logo",
          logoId: logo.id,
          imageId: logo.imageId,
          alt: logo.name,
          size: a.size ?? 100,
        }),
        text: `Added the logo "${logo.name}" [${el.id}].`,
      };
    }
    case "style_cover_page": {
      const a = schemas.style_cover_page.parse(input);
      const overlay = overlayOf(page);
      const paint: CoverAppearance = compact({
        text: a.text,
        shadow: a.shadow,
        shadowColor: a.shadowColor,
      });
      return {
        page: {
          ...page,
          coverOverlay: {
            ...overlay,
            appearance: { ...overlay.appearance, ...paint },
            ...(a.frame !== undefined ? { decoration: a.frame } : {}),
            ...(a.autoMasthead !== undefined
              ? { masthead: a.autoMasthead }
              : {}),
          },
        },
        text: "Set the cover's defaults.",
      };
    }
    default:
      return refuse(`${name} isn't a cover tool`);
  }
}

function itemEdit(
  pages: Page[],
  name: AiCoverToolName,
  input: unknown,
): { pageIdx: number; page: Page; text: string } {
  const parsed =
    name === "remove_cover_item"
      ? schemas.remove_cover_item.parse(input)
      : name === "place_cover_item"
        ? schemas.place_cover_item.parse(input)
        : schemas.style_cover_item.parse(input);
  const { pageIdx, item } = findItem(pages, parsed.id);
  const page = pages[pageIdx]!;
  if (name === "remove_cover_item")
    return {
      pageIdx,
      page:
        item.kind === "element"
          ? {
              ...page,
              coverElements: page.coverElements!.filter(
                (_, i) => i !== item.index,
              ),
            }
          : { ...page, blocks: page.blocks.filter((_, i) => i !== item.index) },
      text: "Removed it.",
    };
  if (name === "place_cover_item") {
    const a = schemas.place_cover_item.parse(input);
    return {
      pageIdx,
      page: withPlacement(page, item, (p) => ({
        ...p,
        column: a.column,
        row: a.row,
        width: a.width,
        align: a.align,
        ...compact({ textSize: a.textSize, order: a.order }),
      })),
      text: `Placed it ${a.row} ${a.column}, ${a.width}, aligned ${a.align}.`,
    };
  }
  const a = schemas.style_cover_item.parse(input);
  const paint: CoverAppearance = compact({
    text: a.text,
    panel: a.panel,
    panelShape: a.panelShape,
    background: a.background,
    shadow: a.shadow,
    shadowColor: a.shadowColor,
  });
  return {
    pageIdx,
    page: withPlacement(page, item, (p) => ({
      ...p,
      appearance: { ...p.appearance, ...paint },
    })),
    text: "Styled it.",
  };
}

const ITEM_TOOLS: ReadonlySet<string> = new Set(AI_COVER_ITEM_TOOLS);

/** "a background photo, a masthead, 2 stories, issue details and a logo". */
export function coverSummary(page: Page): string {
  const els = page.coverElements ?? [];
  const n = (type: CoverElement["type"]) =>
    els.filter((e) => e.type === type).length;
  const stories = n("story");
  const logos = n("logo");
  const parts = [
    page.blocks.some(isBackground) && "a background photo",
    page.blocks.some((b) => b.type === "heading") && "a masthead",
    stories && `${stories} stor${stories > 1 ? "ies" : "y"}`,
    n("details") && "issue details",
    logos && `${logos} logo${logos > 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "nothing on it";
}

export const isCoverTool = (name: string): name is AiCoverToolName =>
  Object.hasOwn(schemas, name);

/** Apply one cover tool. Arguments are parsed here; a refusal throws. */
export async function applyCoverTool(
  ctx: CoverContext,
  name: AiCoverToolName,
  input: unknown,
): Promise<EditResult> {
  const edit = ITEM_TOOLS.has(name)
    ? itemEdit(ctx.pages, name, input)
    : (() => {
        const pageIdx = targetCover(ctx);
        return { pageIdx, ...compose(ctx, name, input, ctx.pages[pageIdx]!) };
      })();
  const pages = ctx.pages.map((p, i) => (i === edit.pageIdx ? edit.page : p));
  const warnings = await ctx.measure.cover(edit.page, pages);
  const said = warnings.length
    ? `Layout warnings: ${warnings.map((w) => w.text).join(" ")}`
    : "No layout warnings.";
  return {
    pages,
    text: `${edit.text} The cover (page ${edit.pageIdx + 1}) now has ${coverSummary(edit.page)}. ${said}`,
    report: [],
  };
}
