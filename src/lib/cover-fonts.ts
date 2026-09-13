import { z } from "zod";
import type { CSSProperties } from "react";
import type { CoverElement } from "./cover-elements";

export const COVER_FONT_IDS = [
  "newsreader",
  "hanken-grotesk",
  "roboto-condensed",
] as const;
export const coverFontSchema = z.enum(COVER_FONT_IDS);
export type CoverFont = z.infer<typeof coverFontSchema>;
export const coverWeightSchema = z.union([
  z.literal(100),
  z.literal(200),
  z.literal(300),
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(900),
]);
export type CoverWeight = z.infer<typeof coverWeightSchema>;
export const COVER_FONTS: Record<
  CoverFont,
  { label: string; css: string; min: number; max: number }
> = {
  newsreader: {
    label: "Newsreader",
    css: "var(--font-cover-newsreader)",
    min: 200,
    max: 800,
  },
  "hanken-grotesk": {
    label: "Hanken Grotesk",
    css: "var(--font-cover-hanken)",
    min: 100,
    max: 900,
  },
  "roboto-condensed": {
    label: "Roboto Condensed",
    css: "var(--font-cover-roboto)",
    min: 100,
    max: 900,
  },
};
const WEIGHT_NAMES = [
  "Thin",
  "Extra Light",
  "Light",
  "Regular",
  "Medium",
  "Semi Bold",
  "Bold",
  "Extra Bold",
  "Black",
];
export const weightName = (weight: number) => WEIGHT_NAMES[weight / 100 - 1]!;
export const weightLabel = (weight: number) =>
  `${weightName(weight)} ${weight}`;
export function fontWeights(family: CoverFont): CoverWeight[] {
  const { min, max } = COVER_FONTS[family];
  return coverWeightSchema.options
    .map((w) => w.value)
    .filter((w) => w >= min && w <= max);
}
/** Four clearly spaced editor choices; the full stored range remains valid. */
export function coverWeightPresets(family: CoverFont): CoverWeight[] {
  return [200, 400, 600, COVER_FONTS[family].max as CoverWeight];
}
export function clampWeight(family: CoverFont, weight: number): CoverWeight {
  const { min, max } = COVER_FONTS[family];
  return Math.max(
    min,
    Math.min(max, Math.round(weight / 100) * 100),
  ) as CoverWeight;
}
export type CoverFontContext = { family: CoverFont; weight: CoverWeight };
export const DEFAULT_FONT_CONTEXT: CoverFontContext = {
  family: "newsreader",
  weight: 400,
};
/** A story headline's own font and weight, with the weight held to the family's range. */
export function storyHeadlineFont(
  element: Extract<CoverElement, { type: "story" }>,
): { family?: CoverFont; weight?: CoverWeight } {
  const family = element.headlineFont ?? "newsreader";
  return {
    // Only an explicit choice opts the headline into the full-range alias.
    family:
      element.headlineFont ?? (element.headlineWeight ? family : undefined),
    weight: element.headlineWeight
      ? clampWeight(family, element.headlineWeight)
      : undefined,
  };
}
// The inherited typography of each cover text field. These mirror the defaults
// in cover-elements.css / the cover block styles; keep the two in step.
export function elementFontContext(
  element: CoverElement,
  field: string,
): CoverFontContext {
  if (element.type === "story" && field.endsWith(":title")) {
    const { family = "newsreader", weight = 500 } = storyHeadlineFont(element);
    return { family, weight: clampWeight(family, weight) };
  }
  return {
    family: "hanken-grotesk",
    weight: field.endsWith(":description") ? 400 : 600,
  };
}
export function blockFontContext(field: string): CoverFontContext {
  return field === "kicker"
    ? { family: "hanken-grotesk", weight: 600 }
    : DEFAULT_FONT_CONTEXT;
}
/** A bold wrapper raises the rendered weight without changing the saved base. */
export const coverWeightCss = (weight: number) =>
  `max(var(--cover-bold-weight, 0), ${weight})`;
/** The bold wrapper's side of the same rule; `.cover-text-editor strong` is its CSS twin. */
export const COVER_BOLD_STYLE = {
  fontWeight: "max(700, var(--cover-font-weight, 700))",
  "--cover-bold-weight": 700,
} as CSSProperties;

/** Optional only: unchanged content continues using the original font declarations. */
export function coverFontStyle(
  family?: CoverFont | null,
  weight?: CoverWeight | null,
): CSSProperties {
  return {
    ...(family ? { fontFamily: COVER_FONTS[family].css } : {}),
    ...(weight
      ? { fontWeight: coverWeightCss(weight), "--cover-font-weight": weight }
      : {}),
  } as CSSProperties;
}
