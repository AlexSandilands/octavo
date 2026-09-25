// Cover tools (#313 territory), in two tiers. "compose" is what #313 scopes:
// a background photo, the masthead, stories linked to real headings, issue
// details, a logo, and removal, with the editor's own placement defaults.
// "style" (beyond #313) adds placement on the cover's grid, colours, panels,
// shadows and fonts, to test whether "compose, not style" is the right line.
// Everything lands through the real cover schemas (cover-elements.ts et al.).
import { z } from "zod";
import { makeBlock, type Block, type Page } from "../../../src/lib/blocks.ts";
import {
  coverColorSchema,
  coverPanelShapeSchema,
  coverShadowSchema,
  type CoverAppearance,
} from "../../../src/lib/cover-appearance.ts";
import {
  COVER_HEADLINE_SIZES,
  coverElementSchema,
  coverPlacementSchema,
  coverSources,
  makeCoverElement,
  makeCoverStory,
  type CoverElement,
  type CoverPlacement,
} from "../../../src/lib/cover-elements.ts";
import {
  clampWeight,
  COVER_FONTS,
  coverFontSchema,
  coverWeightSchema,
  type CoverFont,
  type CoverWeight,
} from "../../../src/lib/cover-fonts.ts";
import { plainCoverDoc } from "../../../src/lib/cover-rich-text.ts";
import { issueImageIds, type IssueContext } from "./seed.ts";

export class CoverRefusal extends Error {}
const refuse = (msg: string): never => {
  throw new CoverRefusal(msg);
};

const id = z.string().min(1).max(64);
const cell = {
  column: z.enum(["left", "center", "right"]),
  row: z.enum(["top", "center", "bottom"]),
  width: z.enum(["narrow", "medium", "wide"]),
  align: z.enum(["left", "center", "right"]),
};
const storyItem = z
  .object({
    headingId: id.optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(600).optional(),
  })
  .strict()
  .refine(
    (i) => i.headingId || i.title?.trim(),
    "each story needs a headingId or a title",
  );

export const composeSchemas = {
  set_cover_background: z
    .object({
      imageId: id,
      fit: z.enum(["fill", "fit"]),
      alt: z.string().max(300).optional(),
    })
    .strict(),
  clear_cover_background: z.object({}).strict(),
  set_masthead: z
    .object({
      title: z.string().min(1).max(300),
      kicker: z.string().max(300).optional(),
    })
    .strict(),
  add_story: z
    .object({
      title: z.string().max(300).optional(),
      items: z.array(storyItem).min(1).max(6),
      headlineSize: z.enum(COVER_HEADLINE_SIZES).optional(),
      showPageNumbers: z.boolean().optional(),
    })
    .strict(),
  add_details: z
    .object({ text: z.string().max(150), showNumber: z.boolean().optional() })
    .strict(),
  add_logo: z
    .object({
      logo: z.string().min(1).max(300),
      size: z.number().int().min(40).max(240).optional(),
    })
    .strict(),
  remove_cover_item: z.object({ id }).strict(),
} as const;

export const styleSchemas = {
  place_cover_item: z
    .object({
      id,
      ...cell,
      textSize: z.enum(["small", "normal", "large", "xlarge"]).optional(),
      order: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
  style_cover_item: z
    .object({
      id,
      text: coverColorSchema.optional(),
      panel: z.boolean().optional(),
      panelShape: coverPanelShapeSchema.optional(),
      background: coverColorSchema.optional(),
      shadow: coverShadowSchema.optional(),
      shadowColor: coverColorSchema.optional(),
      font: coverFontSchema.optional(),
      weight: coverWeightSchema.optional(),
    })
    .strict(),
  style_cover_page: z
    .object({
      text: coverColorSchema.optional(),
      shadow: coverShadowSchema.optional(),
      shadowColor: coverColorSchema.optional(),
      frame: z.boolean().optional(),
      autoMasthead: z.boolean().optional(),
    })
    .strict(),
} as const;

export type ComposeTool = keyof typeof composeSchemas;
export type StyleTool = keyof typeof styleSchemas;
export type CoverTool = ComposeTool | StyleTool;
export const COMPOSE_TOOLS = Object.keys(composeSchemas) as ComposeTool[];
export const STYLE_TOOLS = Object.keys(styleSchemas) as StyleTool[];

export const coverToolsFor = (tier?: "compose" | "style"): CoverTool[] =>
  !tier
    ? []
    : tier === "compose"
      ? COMPOSE_TOOLS
      : [...COMPOSE_TOOLS, ...STYLE_TOOLS];

// --- Applying -----------------------------------------------------------------

function coverPage(ctx: IssueContext): Page {
  return (
    ctx.content.pages.find((p) => p.cover) ??
    refuse("this issue has no cover page")
  );
}

const isBackground = (b: Block) =>
  b.type === "image" && (b.align === "page-fill" || b.align === "page-fit");
const placeholder = (type: CoverElement["type"]): CoverPlacement =>
  makeCoverElement(type).placement;

/** Lettering: the whole field set in one font and weight (how the seed paints mastheads). */
function lettering(
  text: string,
  fontFamily: CoverFont,
  fontWeight: CoverWeight,
) {
  const doc = plainCoverDoc(text);
  for (const p of doc.content)
    for (const n of p.content ?? [])
      if (n.type === "text")
        n.marks = [{ type: "coverPaint", attrs: { fontFamily, fontWeight } }];
  return doc;
}

function checkWeight(font: CoverFont, weight?: CoverWeight) {
  if (weight && clampWeight(font, weight) !== weight)
    refuse(
      `${COVER_FONTS[font].label} comes in weights ${COVER_FONTS[font].min}–${COVER_FONTS[font].max}`,
    );
}

type Item =
  | { kind: "element"; el: CoverElement; index: number }
  | { kind: "block"; block: Block; index: number };
function findItem(page: Page, itemId: string): Item {
  const index = (page.coverElements ?? []).findIndex((e) => e.id === itemId);
  if (index !== -1)
    return { kind: "element", el: page.coverElements![index]!, index };
  const b = page.blocks.findIndex((x) => x.id === itemId);
  if (b !== -1) return { kind: "block", block: page.blocks[b]!, index: b };
  return refuse(`no cover item has id "${itemId}"`);
}

function addElement(page: Page, el: CoverElement): string {
  const parsed = coverElementSchema.safeParse(el);
  if (!parsed.success)
    refuse(`that item isn't valid: ${parsed.error.issues[0]?.message}`);
  if ((page.coverElements?.length ?? 0) >= 16)
    refuse("the cover already holds 16 items");
  page.coverElements = [...(page.coverElements ?? []), parsed.data!];
  return parsed.data!.id;
}

export function applyCoverTool(
  ctx: IssueContext,
  name: CoverTool,
  args: unknown,
): string {
  const page = coverPage(ctx);
  switch (name) {
    case "set_cover_background": {
      const a = composeSchemas.set_cover_background.parse(args);
      if (!issueImageIds(ctx).has(a.imageId))
        refuse(`"${a.imageId}" isn't a photo uploaded to this issue`);
      const block = {
        ...makeBlock("image"),
        imageId: a.imageId,
        align: a.fit === "fill" ? "page-fill" : "page-fit",
        width: 100,
        caption: "",
        alt: a.alt ?? "",
      } as Block;
      const at = page.blocks.findIndex(isBackground);
      if (at === -1) page.blocks.unshift(block);
      else page.blocks[at] = { ...block, id: page.blocks[at]!.id };
      return `Set the cover background to ${a.imageId} (${a.fit}).`;
    }
    case "clear_cover_background": {
      const before = page.blocks.length;
      page.blocks = page.blocks.filter((b) => !isBackground(b));
      if (page.blocks.length === before)
        refuse("the cover has no background photo");
      return "Removed the cover background; the photo is unplaced again.";
    }
    case "set_masthead": {
      const a = composeSchemas.set_masthead.parse(args);
      const at = page.blocks.findIndex((b) => b.type === "heading");
      if (at !== -1) {
        const old = page.blocks[at] as Extract<Block, { type: "heading" }>;
        // A retitled masthead drops lettering painted onto the old words.
        const rich = old.coverPlacement?.richText;
        page.blocks[at] = {
          ...old,
          title: a.title,
          kicker: a.kicker ?? old.kicker,
          coverPlacement:
            old.coverPlacement && rich
              ? { ...old.coverPlacement, richText: undefined }
              : old.coverPlacement,
        };
      } else {
        const placement: CoverPlacement = {
          ...placeholder("details"),
          column: "left",
          row: "top",
          width: "wide",
          align: "left",
          textSize: "xlarge",
          order: 0,
        };
        page.blocks.push({
          ...makeBlock("heading"),
          title: a.title,
          kicker: a.kicker ?? "",
          coverPlacement: placement,
        } as Block);
      }
      // The cover's own masthead replaces the automatic magazine-name line.
      page.coverOverlay = {
        style: "light-shadow",
        position: "top",
        ...page.coverOverlay,
        masthead: false,
      };
      return `Set the masthead to "${a.title}".`;
    }
    case "add_story": {
      const a = composeSchemas.add_story.parse(args);
      const sources = coverSources(ctx.content.pages);
      for (const it of a.items)
        if (it.headingId && !sources.some((s) => s.id === it.headingId))
          refuse(
            `"${it.headingId}" isn't an interior heading — link stories to heading ids from the list`,
          );
      const el = makeCoverElement("story") as Extract<
        CoverElement,
        { type: "story" }
      >;
      const newId = addElement(page, {
        ...el,
        title: a.title ?? "",
        headlineSize: a.headlineSize ?? "list",
        showPageNumbers: a.showPageNumbers ?? a.items.some((i) => i.headingId),
        items: a.items.map((i) => ({
          ...makeCoverStory(i.headingId),
          title: i.title ?? "",
          description: i.description ?? "",
        })),
      });
      return `Added a story [${newId}] with ${a.items.length} item${a.items.length > 1 ? "s" : ""}.`;
    }
    case "add_details": {
      const a = composeSchemas.add_details.parse(args);
      const newId = addElement(page, {
        ...makeCoverElement("details"),
        text: a.text,
        showNumber: a.showNumber ?? true,
      } as CoverElement);
      return `Added issue details [${newId}].`;
    }
    case "add_logo": {
      const a = composeSchemas.add_logo.parse(args);
      const logo =
        ctx.logos.find(
          (l) => l.name.toLowerCase() === a.logo.trim().toLowerCase(),
        ) ??
        refuse(
          `no logo is called "${a.logo}" — use a name from the logo library`,
        );
      const newId = addElement(page, {
        ...makeCoverElement("logo"),
        logoId: logo.id,
        imageId: logo.imageId,
        alt: logo.name,
        size: a.size ?? 100,
      } as CoverElement);
      return `Added the logo "${logo.name}" [${newId}].`;
    }
    case "remove_cover_item": {
      const a = composeSchemas.remove_cover_item.parse(args);
      const item = findItem(page, a.id);
      if (item.kind === "element")
        page.coverElements = page.coverElements!.filter((e) => e.id !== a.id);
      else page.blocks.splice(item.index, 1);
      return "Removed it.";
    }
    case "place_cover_item": {
      const a = styleSchemas.place_cover_item.parse(args);
      const item = findItem(page, a.id);
      const current =
        item.kind === "element"
          ? item.el.placement
          : ((item.block as { coverPlacement?: CoverPlacement })
              .coverPlacement ?? placeholder("details"));
      const placement = coverPlacementSchema.parse({
        ...current,
        column: a.column,
        row: a.row,
        width: a.width,
        align: a.align,
        ...(a.textSize ? { textSize: a.textSize } : {}),
        ...(a.order !== undefined ? { order: a.order } : {}),
      });
      if (item.kind === "element")
        page.coverElements![item.index] = { ...item.el, placement };
      else if (isBackground(item.block))
        refuse("the background fills the page; it can't be placed");
      else
        page.blocks[item.index] = {
          ...item.block,
          coverPlacement: placement,
        } as Block;
      return `Placed it ${a.row} ${a.column}, ${a.width}, aligned ${a.align}.`;
    }
    case "style_cover_item": {
      const a = styleSchemas.style_cover_item.parse(args);
      const item = findItem(page, a.id);
      const paint: CoverAppearance = Object.fromEntries(
        Object.entries({
          text: a.text,
          panel: a.panel,
          panelShape: a.panelShape,
          background: a.background,
          shadow: a.shadow,
          shadowColor: a.shadowColor,
        }).filter(([, v]) => v !== undefined),
      );
      if (item.kind === "block" && isBackground(item.block))
        refuse("the background photo can't be styled");
      const current =
        item.kind === "element"
          ? item.el.placement
          : ((item.block as { coverPlacement?: CoverPlacement })
              .coverPlacement ?? placeholder("details"));
      let placement: CoverPlacement = {
        ...current,
        appearance: { ...current.appearance, ...paint },
      };
      if (item.kind === "element") {
        let el: CoverElement = { ...item.el, placement };
        if (a.font || a.weight) {
          if (el.type === "story") {
            const font = a.font ?? el.headlineFont ?? "newsreader";
            checkWeight(font, a.weight);
            el = {
              ...el,
              headlineFont: font,
              headlineWeight: a.weight ?? el.headlineWeight,
            };
          } else if (el.type === "details") {
            const font = a.font ?? "hanken-grotesk";
            checkWeight(font, a.weight);
            placement = {
              ...placement,
              richText: { text: lettering(el.text, font, a.weight ?? 600) },
            };
            el = { ...el, placement };
          } else refuse("a logo has no lettering to set");
        }
        page.coverElements![item.index] = el;
      } else {
        if (a.font || a.weight) {
          if (item.block.type !== "heading")
            refuse("only the masthead's lettering can be set this way");
          const font = a.font ?? "newsreader";
          checkWeight(font, a.weight);
          placement = {
            ...placement,
            richText: {
              title: lettering(
                (item.block as { title: string }).title,
                font,
                a.weight ?? 400,
              ),
            },
          };
        }
        page.blocks[item.index] = {
          ...item.block,
          coverPlacement: placement,
        } as Block;
      }
      return "Styled it.";
    }
    case "style_cover_page": {
      const a = styleSchemas.style_cover_page.parse(args);
      const overlay = {
        style: "light-shadow" as const,
        position: "top" as const,
        ...page.coverOverlay,
      };
      const paint: CoverAppearance = Object.fromEntries(
        Object.entries({
          text: a.text,
          shadow: a.shadow,
          shadowColor: a.shadowColor,
        }).filter(([, v]) => v !== undefined),
      );
      page.coverOverlay = {
        ...overlay,
        appearance: { ...overlay.appearance, ...paint },
        ...(a.frame !== undefined ? { decoration: a.frame } : {}),
        ...(a.autoMasthead !== undefined ? { masthead: a.autoMasthead } : {}),
      };
      return "Set the cover's defaults.";
    }
  }
}
