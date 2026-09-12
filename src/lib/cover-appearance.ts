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
