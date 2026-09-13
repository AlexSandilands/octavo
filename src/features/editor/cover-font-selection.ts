import type { Mark } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  clampWeight,
  type CoverFont,
  type CoverFontContext,
  type CoverWeight,
} from "@/lib/cover-fonts";

type SelectionState = Pick<EditorState, "selection" | "doc" | "storedMarks">;
/** Stored marks describe future typing, even when they deliberately clear a run's marks. */
export function selectedCoverFont(
  state: SelectionState,
  font: CoverFontContext,
) {
  const { from, to, empty, $from } = state.selection;
  let marks: readonly Mark[] = state.storedMarks ?? $from.marks();
  if (!empty) {
    let found = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && !found) {
        marks = node.marks;
        found = true;
      }
    });
  }
  const attrs =
    marks.find((mark) => mark.type.name === "coverPaint")?.attrs ?? {};
  const family = (attrs.fontFamily ?? null) as CoverFont | null;
  const weight = (attrs.fontWeight ?? null) as CoverWeight | null;
  const effectiveFamily = family ?? font.family;
  const base = weight ?? font.weight;
  const effectiveWeight = clampWeight(
    effectiveFamily,
    marks.some((mark) => mark.type.name === "bold")
      ? Math.max(700, base)
      : base,
  );
  return { family, weight, effectiveFamily, effectiveWeight };
}

/** Change family per run, or the caret's future typing, keeping independent marks. */
export function changeCoverSelectionFamily(
  tr: Transaction,
  family: CoverFont | null,
  inheritedWeight: CoverWeight,
): boolean {
  const { from, to, empty, $from } = tr.selection;
  const paint = tr.doc.type.schema.marks.coverPaint;
  if (!paint) return false;
  const next = (marks: readonly Mark[]) => {
    const attrs = paint.isInSet(marks)?.attrs ?? {};
    return paint.create({
      ...attrs,
      fontFamily: family,
      fontWeight: family
        ? clampWeight(family, attrs.fontWeight ?? inheritedWeight)
        : null,
    });
  };
  if (empty) tr.addStoredMark(next(tr.storedMarks ?? $from.marks()));
  else
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText)
        tr.addMark(
          Math.max(from, pos),
          Math.min(to, pos + node.nodeSize),
          next(node.marks),
        );
    });
  return true;
}

/** A chosen weight replaces Bold, while reset keeps each run's family and emphasis. */
export function changeCoverSelectionWeight(
  tr: Transaction,
  weight: CoverWeight | null,
  font: CoverFontContext,
): boolean {
  const { from, to, empty, $from } = tr.selection;
  const { coverPaint: paint, bold } = tr.doc.type.schema.marks;
  if (!paint || !bold) return false;
  const next = (marks: readonly Mark[]) => {
    const attrs = paint.isInSet(marks)?.attrs ?? {};
    const family: CoverFont = attrs.fontFamily ?? font.family;
    return paint.create({
      ...attrs,
      fontFamily: weight ? family : (attrs.fontFamily ?? null),
      fontWeight: weight ? clampWeight(family, weight) : null,
    });
  };
  if (empty) {
    const mark = next(tr.storedMarks ?? $from.marks());
    if (weight) tr.removeStoredMark(bold);
    tr.addStoredMark(mark);
  } else {
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText)
        tr.addMark(
          Math.max(from, pos),
          Math.min(to, pos + node.nodeSize),
          next(node.marks),
        );
    });
    if (weight) tr.removeMark(from, to, bold);
  }
  return true;
}
