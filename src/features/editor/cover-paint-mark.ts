import {
  COVER_FONTS,
  clampWeight,
  coverFontSchema,
  coverWeightSchema,
  coverWeightCss,
} from "@/lib/cover-fonts";
import { Mark } from "@tiptap/core";
import {
  colorCss,
  coverColorSchema,
  coverShadowSchema,
  shadowCss,
} from "@/lib/cover-appearance";

const FONT_STYLES = new Set(["italic", "normal"]);

// Colour, shadow and italic for a run of cover text. Rendered as data
// attributes (plus the inline style that paints them) so a copy within the
// editor round-trips; on parse each attribute is validated, so pasted markup
// can only ever carry a palette id, a 6-digit hex or a known shadow strength.
export const CoverPaint = Mark.create({
  name: "coverPaint",
  addAttributes() {
    return {
      color: { default: null },
      shadow: { default: null },
      shadowColor: { default: null },
      fontStyle: { default: null },
      fontFamily: { default: null },
      fontWeight: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-cover-paint]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const color = coverColorSchema.safeParse(el.dataset.coverColor);
          const shadow = coverShadowSchema.safeParse(el.dataset.coverShadow);
          const shadowColor = coverColorSchema.safeParse(
            el.dataset.coverShadowColor,
          );
          const fontStyle = el.dataset.coverFontStyle;
          const family = coverFontSchema.safeParse(el.dataset.coverFontFamily);
          const weight = coverWeightSchema.safeParse(
            Number(el.dataset.coverFontWeight),
          );
          const attrs = {
            fontFamily: family.success ? family.data : null,
            fontWeight: weight.success
              ? family.success
                ? clampWeight(family.data, weight.data)
                : weight.data
              : null,
            color: color.success ? color.data : null,
            shadow: shadow.success ? shadow.data : null,
            shadowColor: shadowColor.success ? shadowColor.data : null,
            fontStyle:
              fontStyle && FONT_STYLES.has(fontStyle) ? fontStyle : null,
          };
          return Object.values(attrs).some(Boolean) ? attrs : false;
        },
      },
    ];
  },
  renderHTML({ mark }) {
    const a = mark.attrs;
    const styles = [
      a.color ? `color:${colorCss(a.color)}` : "",
      a.shadow
        ? `text-shadow:${shadowCss(a.shadow, a.shadowColor ?? "ink")}`
        : "",
      a.fontStyle ? `font-style:${a.fontStyle}` : "",
      a.fontFamily
        ? `font-family:${COVER_FONTS[coverFontSchema.parse(a.fontFamily)].css}`
        : "",
      a.fontWeight
        ? `font-weight:${coverWeightCss(a.fontWeight)};--cover-font-weight:${a.fontWeight}`
        : "",
    ]
      .filter(Boolean)
      .join(";");
    return [
      "span",
      {
        "data-cover-paint": "",
        "data-cover-color": a.color ?? undefined,
        "data-cover-shadow": a.shadow ?? undefined,
        "data-cover-shadow-color": a.shadow
          ? (a.shadowColor ?? undefined)
          : undefined,
        "data-cover-font-style": a.fontStyle ?? undefined,
        "data-cover-font-family": a.fontFamily ?? undefined,
        "data-cover-font-weight": a.fontWeight ?? undefined,
        style: styles,
      },
      0,
    ];
  },
});
