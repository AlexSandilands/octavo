import { Mark } from "@tiptap/core";
import { colorCss, coverColorSchema, shadowCss } from "@/lib/cover-appearance";
export const CoverPaint = Mark.create({
  name: "coverPaint",
  addAttributes() {
    return {
      color: { default: null },
      shadow: { default: null },
      shadowColor: { default: null },
      fontStyle: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[style]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const value = el.style.color;
          // Paste only plain hex colours; arbitrary CSS never enters the document.
          return coverColorSchema.safeParse(value).success
            ? { color: value }
            : false;
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
    ]
      .filter(Boolean)
      .join(";");
    return ["span", { style: styles }, 0];
  },
});
