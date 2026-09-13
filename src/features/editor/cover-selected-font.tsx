import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { Mark } from "@tiptap/pm/model";
import {
  type CoverFont,
  type CoverFontContext,
  type CoverWeight,
} from "@/lib/cover-fonts";
import {
  changeCoverSelectionFamily,
  changeCoverSelectionWeight,
  selectedCoverFont,
} from "./cover-font-selection";
import { CoverFontMenus } from "./cover-font-menus";

export function CoverSelectedFont({
  editor,
  font,
}: {
  editor: Editor;
  font: CoverFontContext;
}) {
  const saved = useRef<{
    editor: Editor;
    from: number;
    to: number;
    marks: readonly Mark[] | null;
  } | null>(null);
  const current = selectedCoverFont(editor.state, font);
  const remember = () => {
    const { from, to, empty, $from } = editor.state.selection;
    saved.current = {
      editor,
      from,
      to,
      marks: empty ? [...(editor.state.storedMarks ?? $from.marks())] : null,
    };
  };
  const selectionChain = () => {
    const range = saved.current;
    if (
      !range ||
      range.editor !== editor ||
      editor.isDestroyed ||
      range.to > editor.state.doc.content.size
    )
      return null;
    return editor
      .chain()
      .focus()
      .setTextSelection(range)
      .command(({ tr }) => {
        if (range.marks) tr.setStoredMarks(range.marks);
        return true;
      });
  };
  const applyFamily = (family: CoverFont | null) =>
    selectionChain()
      ?.command(({ tr }) => changeCoverSelectionFamily(tr, family, font.weight))
      .run();
  const applyWeight = (weight: CoverWeight | null) =>
    selectionChain()
      ?.command(({ tr }) => changeCoverSelectionWeight(tr, weight, font))
      .run();
  return (
    <CoverFontMenus
      inline
      {...current}
      onBeforeOpen={remember}
      onFamily={(next) => applyFamily(next ?? null)}
      onWeight={(next) => applyWeight(next ?? null)}
    />
  );
}
