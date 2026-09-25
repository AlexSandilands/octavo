// The cover tools as the model sees them (see cover-tools.ts for the zod).
import type { CoverTool } from "./cover-tools.ts";

const str = (description: string) => ({ type: "string", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const color = str(
  "A palette name (paper, ink, green, blue, sage, stone) or #rrggbb.",
);
const enumOf = (values: string[], description: string) => ({
  type: "string",
  enum: values,
  description,
});
const itemId = str("A cover item id from the projection's cover section.");

export const coverToolDefinitions: {
  name: CoverTool;
  description: string;
  inputSchema: object;
}[] = [
  {
    name: "set_cover_background",
    description:
      "Put an uploaded photo behind the whole cover. fill = crop to cover the page edge to edge; fit = show the whole photo with page-coloured bars. Replaces any existing background.",
    inputSchema: obj(
      {
        imageId: str("A photo id from the issue."),
        fit: enumOf(["fill", "fit"], "fill crops, fit shows it whole."),
        alt: str("What the photo shows, for screen readers."),
      },
      ["imageId", "fit"],
    ),
  },
  {
    name: "clear_cover_background",
    description: "Remove the cover's background photo.",
    inputSchema: obj({}),
  },
  {
    name: "set_masthead",
    description:
      "Set the cover's masthead: the magazine's big title, with an optional kicker line above it. Creates it if the cover has none; the automatic small magazine-name line is turned off.",
    inputSchema: obj(
      {
        title: str("The masthead title."),
        kicker: str("A short line above the title."),
      },
      ["title"],
    ),
  },
  {
    name: "add_story",
    description:
      "Add a story panel to the cover: one to six cover lines, each linked to an interior heading (headingId, so it shows that page's number and follows renames) and/or with its own cover wording (title) and a short description. headlineSize: compact | list | large | display (display = one big lead story).",
    inputSchema: obj(
      {
        title: str('Optional heading over the list, e.g. "Also inside".'),
        items: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: obj({
            headingId: str("An interior heading id from the linkable list."),
            title: str("Cover wording; defaults to the heading's own title."),
            description: str("One or two short lines."),
          }),
        },
        headlineSize: enumOf(
          ["compact", "list", "large", "display"],
          "How big the story titles are set.",
        ),
        showPageNumbers: {
          type: "boolean",
          description:
            "Print each linked story's page number (default: on when linked).",
        },
      },
      ["items"],
    ),
  },
  {
    name: "add_details",
    description:
      "Add the issue details line (e.g. season and edition), optionally with the issue number.",
    inputSchema: obj(
      {
        text: str("Up to 150 characters."),
        showNumber: {
          type: "boolean",
          description: "Show the issue number (default true).",
        },
      },
      ["text"],
    ),
  },
  {
    name: "add_logo",
    description: "Place a logo from the club's logo library on the cover.",
    inputSchema: obj(
      {
        logo: str("The logo's name, exactly as listed."),
        size: {
          type: "integer",
          minimum: 40,
          maximum: 240,
          description: "Size in px (default 100).",
        },
      },
      ["logo"],
    ),
  },
  {
    name: "remove_cover_item",
    description:
      "Remove a cover item (story, details, logo, masthead or other cover block).",
    inputSchema: obj({ id: itemId }, ["id"]),
  },
  {
    name: "place_cover_item",
    description:
      "Place a cover item on the cover's 3×3 grid: column left|center|right, row top|center|bottom, width narrow|medium|wide, text align left|center|right. Items in the same cell stack in `order`. textSize scales its type.",
    inputSchema: obj(
      {
        id: itemId,
        column: enumOf(["left", "center", "right"], "Column."),
        row: enumOf(["top", "center", "bottom"], "Row."),
        width: enumOf(["narrow", "medium", "wide"], "How wide the item is."),
        align: enumOf(["left", "center", "right"], "Text alignment."),
        textSize: enumOf(["small", "normal", "large", "xlarge"], "Type scale."),
        order: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          description: "Stacking order within a cell (lower first).",
        },
      },
      ["id", "column", "row", "width", "align"],
    ),
  },
  {
    name: "style_cover_item",
    description:
      "Style a cover item: text colour, a panel behind it (panelShape block = a box, text = hugging each line) and its colour, a shadow, and the lettering font/weight (story headlines, details, masthead). Fonts: newsreader (serif, 200–800), hanken-grotesk (sans, 100–900), roboto-condensed (condensed sans, 100–900).",
    inputSchema: obj(
      {
        id: itemId,
        text: color,
        panel: { type: "boolean", description: "A panel behind the item." },
        panelShape: enumOf(
          ["block", "text"],
          "block = a box; text = hugs each line.",
        ),
        background: color,
        shadow: enumOf(["none", "soft", "strong"], "Text shadow."),
        shadowColor: color,
        font: enumOf(
          ["newsreader", "hanken-grotesk", "roboto-condensed"],
          "Lettering font.",
        ),
        weight: {
          type: "integer",
          enum: [100, 200, 300, 400, 500, 600, 700, 800, 900],
          description: "Lettering weight, within the font's range.",
        },
      },
      ["id"],
    ),
  },
  {
    name: "style_cover_page",
    description:
      "Cover-wide defaults: the text colour and shadow every item inherits, the theme's decorative frame, and the automatic small magazine-name line.",
    inputSchema: obj({
      text: color,
      shadow: enumOf(["none", "soft", "strong"], "Default text shadow."),
      shadowColor: color,
      frame: { type: "boolean", description: "The theme's decorative frame." },
      autoMasthead: {
        type: "boolean",
        description: "The automatic magazine-name line.",
      },
    }),
  },
];
