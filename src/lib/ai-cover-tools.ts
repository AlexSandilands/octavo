// The assistant's cover tools (#313), lifted from the spike's
// `scripts/spike/assistant/cover-tools.ts` and `cover-tool-defs.ts`: compose a
// cover from the issue's own material, then place and style it on the 3×3
// grid. No font or weight arguments: those stay with the cover inspector. No
// refinements, so the SDK's JSON schema is exact; the editor checks the rest.
import { z } from "zod";
import {
  coverColorSchema,
  coverPanelShapeSchema,
  coverShadowSchema,
} from "./cover-appearance";
import { COVER_HEADLINE_SIZES } from "./cover-elements";

const id = z
  .string()
  .min(1)
  .max(64)
  .describe("A cover item id from the projection's cover section.");
const color = coverColorSchema.describe(
  "A palette name (paper, ink, green, blue, sage, stone) or #rrggbb.",
);
const shadow = coverShadowSchema.describe("Text shadow.");

export const aiCoverToolSchemas = {
  set_cover_background: z
    .object({
      imageId: z.string().min(1).max(64).describe("A photo id from the issue."),
      fit: z
        .enum(["fill", "fit"])
        .describe("fill crops to the page's shape; fit shows it whole."),
      alt: z
        .string()
        .max(300)
        .describe("What the photo shows, for screen readers.")
        .optional(),
    })
    .strict(),
  clear_cover_background: z.object({}).strict(),
  set_masthead: z
    .object({
      title: z.string().min(1).max(300).describe("The masthead title."),
      kicker: z
        .string()
        .max(300)
        .describe("A short line above the title.")
        .optional(),
    })
    .strict(),
  add_story: z
    .object({
      title: z
        .string()
        .max(300)
        .describe('Optional heading over the list, e.g. "Also inside".')
        .optional(),
      items: z
        .array(
          z
            .object({
              headingId: z
                .string()
                .min(1)
                .max(64)
                .describe("An interior heading id from the linkable list.")
                .optional(),
              title: z
                .string()
                .max(300)
                .describe("Cover wording; defaults to the heading's own title.")
                .optional(),
              description: z
                .string()
                .max(600)
                .describe("One or two short lines.")
                .optional(),
            })
            .strict(),
        )
        .min(1)
        .max(6),
      headlineSize: z
        .enum(COVER_HEADLINE_SIZES)
        .describe("How big the story titles are set.")
        .optional(),
      showPageNumbers: z
        .boolean()
        .describe(
          "Print each linked story's page number (default: on when linked).",
        )
        .optional(),
    })
    .strict(),
  add_details: z
    .object({
      text: z.string().max(150).describe("Up to 150 characters."),
      showNumber: z
        .boolean()
        .describe("Show the issue number (default true).")
        .optional(),
    })
    .strict(),
  add_logo: z
    .object({
      logo: z
        .string()
        .min(1)
        .max(300)
        .describe("The logo's name, exactly as listed."),
      size: z
        .number()
        .int()
        .min(40)
        .max(240)
        .describe("Size in px (default 100).")
        .optional(),
    })
    .strict(),
  remove_cover_item: z.object({ id }).strict(),
  place_cover_item: z
    .object({
      id,
      column: z.enum(["left", "center", "right"]).describe("Column."),
      row: z.enum(["top", "center", "bottom"]).describe("Row."),
      width: z
        .enum(["narrow", "medium", "wide"])
        .describe("How wide the item is."),
      align: z.enum(["left", "center", "right"]).describe("Text alignment."),
      textSize: z
        .enum(["small", "normal", "large", "xlarge"])
        .describe("Type scale.")
        .optional(),
      order: z
        .number()
        .int()
        .min(0)
        .max(10000)
        .describe("Stacking order within a cell (lower first).")
        .optional(),
    })
    .strict(),
  style_cover_item: z
    .object({
      id,
      text: color.optional(),
      panel: z.boolean().describe("A panel behind the item.").optional(),
      panelShape: coverPanelShapeSchema
        .describe("block = a box; text = hugs each line.")
        .optional(),
      background: color.optional(),
      shadow: shadow.optional(),
      shadowColor: color.optional(),
    })
    .strict(),
  style_cover_page: z
    .object({
      text: color.optional(),
      shadow: shadow.optional(),
      shadowColor: color.optional(),
      frame: z.boolean().describe("The theme's decorative frame.").optional(),
      autoMasthead: z
        .boolean()
        .describe("The automatic small magazine-name line.")
        .optional(),
    })
    .strict(),
} as const;

export type AiCoverToolName = keyof typeof aiCoverToolSchemas;

export const aiCoverToolDescriptions: Record<AiCoverToolName, string> = {
  set_cover_background:
    "Put an uploaded photo behind the whole cover. fill = crop to cover the page edge to edge; fit = show the whole photo with page-coloured bars. A previous background stays on the cover as an ordinary photo.",
  clear_cover_background: "Remove the cover's background photo.",
  set_masthead:
    "Set the cover's masthead: the magazine's big title, with an optional kicker line above it. Creates it top left if the cover has none; the automatic small magazine-name line is turned off.",
  add_story:
    "Add a story panel to the cover: one to six cover lines, each linked to an interior heading (headingId, so it shows that page's number and follows renames) and/or with its own cover wording (title) and a short description. headlineSize: compact | list | large | display (display = one big lead story).",
  add_details:
    "Add the issue details line (e.g. season and edition), optionally with the issue number.",
  add_logo: "Place a logo from the club's logo library on the cover.",
  remove_cover_item:
    "Remove a cover item (story, details, logo, masthead or other cover block).",
  place_cover_item:
    "Place a cover item on the cover's 3×3 grid: column left|center|right, row top|center|bottom, width narrow|medium|wide, text align left|center|right. Items in the same cell stack in `order`. textSize scales its type.",
  style_cover_item:
    "Style a cover item: its text colour, a panel behind it (panelShape block = a box, text = hugging each line) and the panel's colour, and a text shadow and its colour.",
  style_cover_page:
    "Cover-wide defaults: the text colour and shadow every item inherits, the theme's decorative frame, and the automatic small magazine-name line.",
};

/** The cover tools that take an item id; the rest act on the cover itself. */
export const AI_COVER_ITEM_TOOLS = [
  "remove_cover_item",
  "place_cover_item",
  "style_cover_item",
] as const satisfies readonly AiCoverToolName[];
