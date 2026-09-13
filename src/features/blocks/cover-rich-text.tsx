import { Fragment, type ReactNode, type CSSProperties } from "react";
import { coverDocFor, type CoverRichDoc } from "@/lib/cover-rich-text";
import { coverFontStyle } from "@/lib/cover-fonts";
import { colorCss, shadowCss } from "@/lib/cover-appearance";

const boldStyle = {
  fontWeight: "max(700, var(--cover-font-weight, 700))",
  "--cover-bold-weight": 700,
} as CSSProperties;

export function CoverRichText({
  text,
  doc,
}: {
  text: string;
  doc?: CoverRichDoc;
}) {
  const value = coverDocFor(text, doc);
  return (
    <>
      {value.content.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {p.content?.map((node, j) => {
            if (node.type === "hardBreak") return <br key={j} />;
            let content: ReactNode = node.text;
            for (const mark of [...(node.marks ?? [])].reverse()) {
              if (mark.type === "bold")
                content = <strong style={boldStyle}>{content}</strong>;
              else if (mark.type === "italic") content = <em>{content}</em>;
              else if (mark.type === "underline") content = <u>{content}</u>;
              else if (mark.type === "coverPaint") {
                const a = mark.attrs;
                const style: CSSProperties = {
                  ...coverFontStyle(a.fontFamily, a.fontWeight),
                  color: a.color ? colorCss(a.color) : undefined,
                  fontStyle: a.fontStyle ?? undefined,
                  textShadow: a.shadow
                    ? shadowCss(a.shadow, a.shadowColor ?? "ink")
                    : undefined,
                };
                content = <span style={style}>{content}</span>;
              }
            }
            return <Fragment key={j}>{content}</Fragment>;
          })}
        </Fragment>
      ))}
    </>
  );
}
