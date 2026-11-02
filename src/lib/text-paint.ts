import { z } from "zod";
import type { CSSProperties } from "react";
import {
  colorCss,
  coverColorSchema,
  type CoverColor,
} from "./cover-appearance";
import { COVER_FONTS, coverFontSchema, type CoverFont } from "./cover-fonts";

// A colour and typeface for words on an interior page (content v11): selected
// words in body text carry it as a `paint` mark, a heading as `paint` on its
// title. Same bounded choices as the cover — the magazine swatches or a 6-digit
// hex, and the three cover fonts. Absent means the theme's own style.
export type TextPaint = { color?: CoverColor; font?: CoverFont };

// Lenient by design: a tampered or pasted value drops the attribute rather than
// failing the save, the way an unsafe link href drops the link.
const keep = <T>(schema: z.ZodType<T>, v: unknown): T | undefined => {
  const r = schema.safeParse(v);
  return r.success ? r.data : undefined;
};
export function cleanPaint(raw: {
  color?: unknown;
  font?: unknown;
}): TextPaint | undefined {
  const color = keep(coverColorSchema, raw.color);
  const font = keep(coverFontSchema, raw.font);
  if (!color && !font) return undefined;
  return { ...(color && { color }), ...(font && { font }) };
}

export const textPaintSchema = z
  .object({ color: z.unknown(), font: z.unknown() })
  .partial()
  .transform(cleanPaint) as unknown as z.ZodType<
  TextPaint | undefined,
  z.ZodTypeDef,
  unknown
>;

export function paintStyle(
  paint?: TextPaint | null,
): CSSProperties | undefined {
  if (!paint?.color && !paint?.font) return undefined;
  return {
    ...(paint.color && { color: colorCss(paint.color) }),
    ...(paint.font && { fontFamily: COVER_FONTS[paint.font].css }),
  };
}
