import type { Transaction } from "@tiptap/pm/state";
import {
  clampWeight,
  type CoverFont,
  type CoverWeight,
} from "@/lib/cover-fonts";

/** Change family per run: mixed weights and all independent marks stay intact. */
export function changeCoverSelectionFamily(
  tr: Transaction,
  family: CoverFont | null,
  inheritedWeight: CoverWeight,
): boolean {
  const { from, to, empty } = tr.selection;
  const paint = tr.doc.type.schema.marks.coverPaint;
  if (empty || !paint) return false;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const attrs = paint.isInSet(node.marks)?.attrs ?? {};
    tr.addMark(
      Math.max(from, pos),
      Math.min(to, pos + node.nodeSize),
      paint.create({
        ...attrs,
        fontFamily: family,
        fontWeight: family
          ? clampWeight(family, attrs.fontWeight ?? inheritedWeight)
          : null,
      }),
    );
  });
  return true;
}
