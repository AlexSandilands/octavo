import { Extension } from "@tiptap/core";
import type { Mark } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  clampWeight,
  DEFAULT_FONT_CONTEXT,
  type CoverFontContext,
} from "@/lib/cover-fonts";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    coverBoldShortcuts: {
      setCoverBoldContext: (font: CoverFontContext) => ReturnType;
    };
  }
}

type SelectionState = Pick<EditorState, "selection" | "doc" | "storedMarks">;
const paintAttrs = (marks: readonly Mark[]) =>
  marks.find((mark) => mark.type.name === "coverPaint")?.attrs ?? {};
function effectiveWeight(marks: readonly Mark[], font: CoverFontContext) {
  const attrs = paintAttrs(marks);
  const base = attrs.fontWeight ?? font.weight;
  return clampWeight(
    attrs.fontFamily ?? font.family,
    marks.some((mark) => mark.type.name === "bold")
      ? Math.max(700, base)
      : base,
  );
}

/** A mixed selection is on only when every selected run looks bold. */
export function coverSelectionIsBold(
  state: SelectionState,
  font: CoverFontContext,
): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty)
    return effectiveWeight(state.storedMarks ?? $from.marks(), font) >= 700;
  let found = false,
    allBold = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    found = true;
    if (effectiveWeight(node.marks, font) < 700) allBold = false;
  });
  return found && allBold;
}

/** Bold and the weight menu share one appearance, including inherited weights. */
export function toggleCoverSelectionBold(
  tr: Transaction,
  font: CoverFontContext,
): boolean {
  const { from, to, empty, $from } = tr.selection;
  const { coverPaint: paint, bold } = tr.doc.type.schema.marks;
  if (!paint || !bold) return false;
  const turnOff = coverSelectionIsBold(tr, font);
  const nextPaint = (marks: readonly Mark[]) => {
    const attrs = paintAttrs(marks);
    const family = attrs.fontFamily ?? font.family;
    return paint.create({
      ...attrs,
      fontFamily: family,
      fontWeight: turnOff
        ? 400
        : clampWeight(family, Math.max(700, effectiveWeight(marks, font))),
    });
  };
  if (empty) {
    const mark = nextPaint(tr.storedMarks ?? $from.marks());
    tr.removeStoredMark(bold).addStoredMark(mark);
  } else {
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText)
        tr.addMark(
          Math.max(from, pos),
          Math.min(to, pos + node.nodeSize),
          nextPaint(node.marks),
        );
    });
    tr.removeMark(from, to, bold);
  }
  return true;
}

/** Cover-only shortcut precedence; the ordinary body editor keeps its own Bold. */
export type CoverBoldStorage = { font: CoverFontContext };
export const CoverBoldShortcuts = Extension.create<
  CoverBoldStorage,
  CoverBoldStorage
>({
  name: "coverBoldShortcuts",
  priority: 1000,
  addOptions() {
    return { font: DEFAULT_FONT_CONTEXT };
  },
  addStorage() {
    return { font: this.options.font };
  },
  addCommands() {
    return {
      setCoverBoldContext: (font) => () => {
        this.storage.font = font;
        return true;
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-b": () =>
        this.editor.commands.command(({ tr }) =>
          toggleCoverSelectionBold(tr, this.storage.font),
        ),
    };
  },
});
