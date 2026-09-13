import type { Block, Page } from "../../lib/blocks";
import type { CoverAppearance } from "../../lib/cover-appearance";
import {
  DEFAULT_COVER_PLACEMENT,
  coverSources,
  type CoverElement,
  type CoverPlacement,
} from "../../lib/cover-elements";
import type { CoverFont, CoverWeight } from "../../lib/cover-fonts";
import { plainCoverDoc } from "../../lib/cover-rich-text";
import type { SeedIssue } from "./builders";
import type { SeedImages } from "./images";

const id = () => crypto.randomUUID();
const placement = (overrides: Partial<CoverPlacement>): CoverPlacement => ({
  ...DEFAULT_COVER_PLACEMENT,
  column: "left",
  align: "left",
  ...overrides,
});

function lettering(
  text: string,
  fontFamily: CoverFont,
  fontWeight: CoverWeight,
) {
  const doc = plainCoverDoc(text);
  for (const paragraph of doc.content)
    for (const node of paragraph.content ?? [])
      if (node.type === "text")
        node.marks = [
          { type: "coverPaint", attrs: { fontFamily, fontWeight } },
        ];
  return doc;
}

export const SEED_LOGOS = [
  {
    id: "seed-aperture-logo",
    name: "Aperture · shutter mark",
    imageKey: "aperture-mark",
  },
  {
    id: "seed-regatta-logo",
    name: "Regatta · sailing club burgee",
    imageKey: "regatta-mark",
  },
  {
    id: "seed-kiln-logo",
    name: "Kiln & Wheel · potters’ seal",
    imageKey: "kiln-mark",
  },
] as const;

type Design = {
  name: "aperture" | "regatta" | "kiln";
  title: string;
  kicker: string;
  date: string;
  font: CoverFont;
  weight: CoverWeight;
  ink: string;
  ground: string;
  accent: string;
  lead: { source: string; title: string; description: string };
  secondary: { source: string; title: string }[];
};

const designs: Record<number, Design> = {
  2: {
    name: "aperture",
    title: "APERTURE",
    kicker: "The Camera Club Quarterly",
    date: "Winter 2025 · The salon edition",
    font: "hanken-grotesk",
    weight: 900,
    ink: "#e8eaed",
    ground: "#23272e",
    accent: "#efab57",
    lead: {
      source: "The Winter Salon",
      title: "The art of\nlooking.",
      description:
        "Forty-one prints. One wall.\nA winter salon worth the wait.",
    },
    secondary: [
      { source: "Light, Found and Kept", title: "Light, found & kept" },
      { source: "The Long Exposure", title: "Four minutes of stillness" },
    ],
  },
  6: {
    name: "regatta",
    title: "REGATTA",
    kicker: "The Sailing Club Annual",
    date: "Winter 2026 · Season review",
    font: "roboto-condensed",
    weight: 900,
    ink: "#e7eef2",
    ground: "#16283f",
    accent: "#f0a28d",
    lead: {
      source: "Champion, Unranked",
      title: "Against\nthe odds.",
      description: "Nine races. One dismasting.\nThe champion nobody picked.",
    },
    secondary: [
      { source: "A Wind With Opinions", title: "A wind with opinions" },
      { source: "The Decider", title: "Down to the final mark" },
    ],
  },
  4: {
    name: "kiln",
    title: "Kiln & Wheel",
    kicker: "The Potters’ Guild Annual",
    date: "Summer 2026 · A year of making",
    font: "newsreader",
    weight: 400,
    ink: "#4a2c1f",
    ground: "#f0e0cf",
    accent: "#3f6459",
    lead: {
      source: "The Glaze That Almost Worked",
      title: "Earth, fire\n& a little faith.",
      description: "The glaze that almost worked.\nThe hands that tried again.",
    },
    secondary: [
      { source: "The Night Firing", title: "Through the night" },
      { source: "The Members' Show", title: "Made to be kept" },
    ],
  },
};

/** Three art-directed covers; the other three and every interior remain untouched. */
export function withCoverElements(
  issue: SeedIssue,
  img: SeedImages,
): SeedIssue {
  const design = designs[issue.number];
  if (!design) return issue;
  const front = issue.content.pages[0]!;
  const sources = coverSources(issue.content.pages);
  const sourceId = (title: string) => {
    const source = sources.find((s) => s.title === title);
    if (!source) throw new Error(`Missing seed cover story: ${title}`);
    return source.id;
  };
  const paint: CoverAppearance = {
    panel: false,
    text: design.ink,
    background: design.ground,
    shadow: "none",
  };
  const titleBlock: Block = {
    id: id(),
    type: "heading",
    title: design.title,
    kicker: design.kicker,
    coverPlacement: placement({
      row: "top",
      textSize: "xlarge",
      order: 0,
      richText: { title: lettering(design.title, design.font, design.weight) },
    }),
  };
  const logo = SEED_LOGOS.find((l) => l.imageKey === `${design.name}-mark`)!;
  const elements: CoverElement[] = [
    {
      id: id(),
      type: "details",
      showNumber: true,
      text: design.date,
      placement: placement({
        row: "top",
        order: 1,
        appearance:
          design.name === "aperture"
            ? { ...paint, panel: true, panelShape: "text" }
            : undefined,
        richText: { text: lettering(design.date, "hanken-grotesk", 600) },
      }),
    },
    {
      id: id(),
      type: "logo",
      logoId: logo.id,
      imageId: img[logo.imageKey],
      alt: logo.name,
      size: 64,
      placement: placement({ row: "center", offset: -30 }),
    },
    {
      id: id(),
      type: "story",
      title: "",
      headlineSize: "display",
      headlineFont: "newsreader",
      headlineWeight: 800,
      showPageNumbers: true,
      items: [
        {
          id: id(),
          headingId: sourceId(design.lead.source),
          title: design.lead.title,
          description: design.lead.description,
        },
      ],
      placement: placement({
        row: "bottom",
        width: "medium",
        appearance: { ...paint, panel: true, panelShape: "text" },
      }),
    },
    {
      id: id(),
      type: "story",
      title: "Also inside",
      headlineSize: "list",
      headlineFont:
        design.name === "kiln" ? "roboto-condensed" : "hanken-grotesk",
      headlineWeight: design.name === "kiln" ? 900 : 600,
      showPageNumbers: true,
      items: design.secondary.map((s) => ({
        id: id(),
        headingId: sourceId(s.source),
        title: s.title,
        description: "",
      })),
      placement: placement({
        row: "bottom",
        column: "right",
        align: "right",
        width: "medium",
        appearance: { ...paint, panel: true, text: design.accent },
      }),
    },
  ];
  const cover: Page = {
    ...front,
    coverOverlay: {
      style: "light",
      position: "top",
      decoration: false,
      masthead: false,
      appearance: paint,
    },
    blocks: [
      {
        id: id(),
        type: "image",
        imageId: img[`${design.name}-cover`],
        align: "page-fill",
        width: 100,
        caption: "",
        alt: {
          aperture:
            "An abstract camera lens: concentric amber, slate and silver discs against charcoal.",
          regatta:
            "A cream-sailed yacht crosses navy water beneath a coral sun, in a vintage sailing illustration.",
          kiln: "A hand-thrown terracotta vessel with fine throwing rings on a warm clay-coloured ground.",
        }[design.name],
      },
      titleBlock,
    ],
    coverElements: elements,
  };
  return {
    ...issue,
    content: {
      ...issue.content,
      pages: [cover, ...issue.content.pages.slice(1)],
    },
  };
}
