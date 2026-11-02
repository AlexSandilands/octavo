import { Mark, type Editor } from "@tiptap/core";
import type { Mark as PMMark } from "@tiptap/pm/model";
import { colorCss, type CoverColor } from "@/lib/cover-appearance";
import { COVER_FONTS, type CoverFont } from "@/lib/cover-fonts";
import { cleanPaint } from "@/lib/text-paint";

// Colour and typeface for selected words in body text (content v11), stored as
// the `paint` mark richDocSchema knows. The cover's CoverPaint twin, cut down to
// the two choices interior pages offer; pasted markup is re-checked on parse.
export const Paint = Mark.create({
  name: "paint",
  addAttributes() {
    return { color: { default: null }, font: { default: null } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-paint]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const paint = cleanPaint({
            color: el.dataset.paintColor,
            font: el.dataset.paintFont,
          });
          return paint
            ? { color: paint.color ?? null, font: paint.font ?? null }
            : false;
        },
      },
    ];
  },
  renderHTML({ mark }) {
    const paint = cleanPaint(mark.attrs);
    const style = [
      paint?.color ? `color:${colorCss(paint.color)}` : "",
      paint?.font ? `font-family:${COVER_FONTS[paint.font].css}` : "",
    ]
      .filter(Boolean)
      .join(";");
    return [
      "span",
      {
        "data-paint": "",
        "data-paint-color": paint?.color,
        "data-paint-font": paint?.font,
        style,
      },
      0,
    ];
  },
});

/** Set (or with null, clear) the selection's colour/font, keeping the other
 *  choice; a run left with neither loses the mark rather than keep an empty one.
 *  `range` restores a selection a menu's focus took away. */
export function setPaint(
  editor: Editor,
  attrs: { color?: CoverColor | null; font?: CoverFont | null },
  range?: { from: number; to: number } | null,
) {
  const chain = editor.chain().focus();
  if (range && range.to <= editor.state.doc.content.size)
    chain.setTextSelection(range);
  chain
    .setMark("paint", attrs)
    .command(({ tr }) => {
      const type = tr.doc.type.schema.marks.paint!;
      const empty = (m: PMMark) => !m.attrs.color && !m.attrs.font;
      const { from, to } = tr.selection;
      tr.doc.nodesBetween(from, to, (node, pos) => {
        const mark = node.isText && node.marks.find((m) => m.type === type);
        if (mark && empty(mark))
          tr.removeMark(
            Math.max(pos, from),
            Math.min(pos + node.nodeSize, to),
            type,
          );
      });
      const stored = tr.storedMarks?.find((m) => m.type === type);
      if (stored && empty(stored)) tr.removeStoredMark(type);
      return true;
    })
    .run();
}
