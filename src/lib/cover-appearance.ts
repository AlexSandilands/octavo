import { z } from "zod";
import type { CSSProperties } from "react";

export const COVER_PALETTE = [
  { value: "paper", label: "Paper", css: "var(--color-page)" },
  { value: "ink", label: "Charcoal", css: "var(--color-ink)" },
  { value: "green", label: "Forest", css: "var(--color-accent)" },
  { value: "blue", label: "Blue", css: "var(--color-cover-blue)" },
  { value: "sage", label: "Sage", css: "var(--color-accent-soft)" },
  { value: "stone", label: "Warm stone", css: "var(--color-page-frame)" },
] as const;
export const coverColorSchema = z.union([
  z.enum(["paper", "ink", "green", "blue", "sage", "stone"]),
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
]);
export type CoverColor = z.infer<typeof coverColorSchema>;
export const coverShadowSchema = z.enum(["none", "soft", "strong"]);
export type CoverShadow = z.infer<typeof coverShadowSchema>;
export const coverAppearanceSchema = z.object({
  panel: z.boolean().optional(),
  background: coverColorSchema.optional(),
  text: coverColorSchema.optional(),
  shadow: coverShadowSchema.optional(),
  shadowColor: coverColorSchema.optional(),
});
export type CoverAppearance = z.infer<typeof coverAppearanceSchema>;
export function colorCss(color: CoverColor): string {
  return COVER_PALETTE.find((p) => p.value === color)?.css ?? color;
}
export function shadowCss(shadow: CoverShadow, color: CoverColor): string {
  if (shadow === "none") return "none";
  const ink = colorCss(color);
  return shadow === "soft"
    ? `0 1px 2px color-mix(in srgb, ${ink} 80%, transparent), 0 2px 6px color-mix(in srgb, ${ink} 65%, transparent)`
    : `0 2px 3px ${ink}, 0 3px 10px ${ink}`;
}
/** Old contrast presets remain readable; new controls override their individual parts. */
export function resolveCoverAppearance(
  style = "dark",
  value?: CoverAppearance,
): Required<CoverAppearance> {
  return {
    panel: style === "paper-panel" || style === "ink-panel",
    background: style === "ink-panel" ? "ink" : "paper",
    text: ["dark", "dark-shadow", "paper-panel"].includes(style)
      ? "ink"
      : "paper",
    shadow: style.endsWith("shadow") ? "soft" : "none",
    shadowColor: style === "dark-shadow" ? "paper" : "ink",
    ...value,
  };
}
export function appearanceVars(
  value: Required<CoverAppearance>,
): CSSProperties {
  return {
    "--cover-ink": colorCss(value.text),
    "--cover-background": colorCss(value.background),
    "--cover-shadow": shadowCss(value.shadow, value.shadowColor),
  } as CSSProperties;
}

// Which palette entries read as light. A custom hex is judged by luminance.
const LIGHT = new Set<string>(["paper", "stone"]);
export function isLightColor(color: CoverColor): boolean {
  if (!color.startsWith("#")) return LIGHT.has(color);
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.35;
}
/** The text caret follows the text colour, which vanishes when the words match
 *  their panel. Pick a caret that contrasts with what is behind them instead. */
export function caretColorFor(
  paint: Required<CoverAppearance>,
  overPhoto: boolean,
): string {
  if (paint.panel)
    return isLightColor(paint.background)
      ? "var(--color-ink)"
      : "var(--color-page)";
  return overPhoto ? colorCss(paint.text) : "var(--color-ink)";
}
