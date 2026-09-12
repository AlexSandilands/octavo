import { z } from "zod";
import { coverAppearanceSchema } from "./cover-appearance";
import { coverRichFieldsSchema } from "./cover-rich-text";
import type { Page } from "./blocks";
import { createId } from "./id";

export const COVER_STYLES = [
  "light",
  "dark",
  "light-shadow",
  "dark-shadow",
  "paper-panel",
  "ink-panel",
] as const;
export const coverStyleSchema = z.enum(COVER_STYLES);
export const coverOverlaySchema = z.object({
  appearance: coverAppearanceSchema.optional(),
  style: coverStyleSchema,
  // Legacy: the row headings/text without their own placement fall back to.
  position: z.enum(["top", "center", "bottom"]),
  decoration: z.boolean().optional(),
  masthead: z.boolean().optional(),
});
export type CoverOverlay = z.infer<typeof coverOverlaySchema>;
export const DEFAULT_COVER_OVERLAY: CoverOverlay = {
  style: "light-shadow",
  position: "center",
};
export const COVER_LAYER_MAX = 20;
export const coverPlacementSchema = z.object({
  column: z.enum(["left", "center", "right"]),
  row: z.enum(["top", "center", "bottom"]),
  width: z.enum(["narrow", "medium", "wide"]),
  align: z.enum(["left", "center", "right"]),
  offset: z.number().int().min(-60).max(60).default(0),
  style: coverStyleSchema.optional(),
  appearance: coverAppearanceSchema.optional(),
  richText: coverRichFieldsSchema.optional(),
  textSize: z.enum(["small", "normal", "large", "xlarge"]).optional(),
  order: z.number().int().min(0).max(10000).optional(),
  // Stacking when items overlap: higher prints in front. 0 when unset.
  layer: z.number().int().min(-COVER_LAYER_MAX).max(COVER_LAYER_MAX).optional(),
});
export type CoverPlacement = z.infer<typeof coverPlacementSchema>;
export function coverTextScale(placement?: CoverPlacement): number {
  return { small: 0.8, normal: 1, large: 1.2, xlarge: 1.4 }[
    placement?.textSize ?? "normal"
  ];
}
/** One step forward (+1) or back (-1) in the stacking order, held to the cap. */
export function nudgeLayer(
  placement: CoverPlacement,
  direction: -1 | 1,
): CoverPlacement {
  const layer = Math.max(
    -COVER_LAYER_MAX,
    Math.min(COVER_LAYER_MAX, (placement.layer ?? 0) + direction),
  );
  return { ...placement, layer: layer === 0 ? undefined : layer };
}
export const DEFAULT_COVER_PLACEMENT: CoverPlacement = {
  column: "center",
  row: "center",
  width: "wide",
  align: "center",
  offset: 0,
};
const base = { id: z.string().max(64), placement: coverPlacementSchema };
/** One story in a cover section: free-standing, or linked to a section heading. */
export const coverStorySchema = z.object({
  id: z.string().max(64),
  headingId: z.string().max(64).optional(),
  title: z.string().max(300).default(""),
  description: z.string().max(600).default(""),
});
export const MAX_COVER_ELEMENTS = 16;
export const MAX_COVER_PREVIEWS = 6;
export const COVER_HEADLINE_SIZES = [
  "compact",
  "list",
  "large",
  "display",
] as const;
export const coverElementSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("section"),
    /** The optional list heading ("Inside this issue"); empty prints nothing. */
    title: z.string().max(300).default(""),
    items: z.array(coverStorySchema).min(1).max(MAX_COVER_PREVIEWS),
    showPageNumbers: z.boolean().default(false),
    headlineSize: z.enum(COVER_HEADLINE_SIZES).default("list"),
  }),
  z.object({
    ...base,
    type: z.literal("details"),
    showNumber: z.boolean().default(true),
    text: z.string().max(150).default(""),
  }),
  z.object({
    ...base,
    type: z.literal("logo"),
    logoId: z.string().max(64).optional(),
    imageId: z.string().max(64).optional(),
    alt: z.string().max(300).default(""),
    size: z.number().int().min(40).max(240).default(100),
  }),
]);
export type CoverElement = z.infer<typeof coverElementSchema>;
export type CoverElementType = CoverElement["type"];
export type CoverStory = z.infer<typeof coverStorySchema>;
export type CoverHeadlineSize = (typeof COVER_HEADLINE_SIZES)[number];
export const COVER_ELEMENT_LABELS: Record<CoverElementType, string> = {
  section: "Section",
  details: "Issue details",
  logo: "Logo",
};
/** Names one item apart from its siblings: two Sections share one label. */
export function coverElementName(
  element: CoverElement,
  sources: CoverSource[],
): string {
  const label = COVER_ELEMENT_LABELS[element.type];
  if (element.type !== "section") return label;
  const said = element.title || previewTitle(element.items[0]!, sources);
  return said ? `${label}: ${said}` : label;
}
export function makeCoverStory(headingId?: string): CoverStory {
  return { id: createId(), headingId, title: "", description: "" };
}
export function makeCoverElement(type: CoverElementType): CoverElement {
  const logo = type === "logo";
  const placement: CoverPlacement = {
    ...DEFAULT_COVER_PLACEMENT,
    column: logo ? "right" : "left",
    row: type === "details" ? "top" : logo ? "bottom" : "center",
    width: "medium",
    align: logo ? "right" : "left",
  };
  const common = { id: createId(), placement };
  switch (type) {
    case "section":
      return {
        ...common,
        type: "section",
        title: "",
        items: [makeCoverStory()],
        showPageNumbers: false,
        headlineSize: "list",
      };
    case "details":
      return { ...common, type: "details", showNumber: true, text: "" };
    case "logo":
      return { ...common, type: "logo", alt: "", size: 100 };
  }
}
export type CoverSource = {
  id: string;
  pageId: string;
  pageNo: number;
  title: string;
};
/** Derived from live headings so renames and pagination never leave stale cover copy. */
export function coverSources(pages: Page[]): CoverSource[] {
  return pages.flatMap((page, i) =>
    page.blocks.flatMap((b) =>
      b.type === "heading" && b.title.trim() && !page.cover
        ? [{ id: b.id, pageId: page.id, pageNo: i + 1, title: b.title }]
        : [],
    ),
  );
}
export function previewTitle(
  item: { title: string; headingId?: string },
  sources: CoverSource[],
) {
  return (
    (item.title.trim()
      ? item.title
      : sources.find((s) => s.id === item.headingId)?.title) || ""
  );
}
