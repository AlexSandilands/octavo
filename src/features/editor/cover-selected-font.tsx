import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  type CoverFont,
  type CoverFontContext,
  type CoverWeight,
} from "@/lib/cover-fonts";
import { changeCoverSelectionFamily } from "./cover-font-selection";
import { CoverFontMenus } from "./cover-font-menus";

export function CoverSelectedFont({
  editor,
  font,
}: {
  editor: Editor;
  font: CoverFontContext;
}) {
  const saved = useRef<{ editor: Editor; from: number; to: number } | null>(
    null,
  );
  const paint = editor.getAttributes("coverPaint");
  const family = paint.fontFamily as CoverFont | null;
  const weight = paint.fontWeight as CoverWeight | null;
  const effectiveFamily = family ?? font.family;
  const remember = () => {
    const { from, to, empty } = editor.state.selection;
    saved.current = empty ? null : { editor, from, to };
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
    return editor.chain().focus().setTextSelection(range);
  };
  const applyFamily = (family: CoverFont | null) =>
    selectionChain()
      ?.command(({ tr }) => changeCoverSelectionFamily(tr, family, font.weight))
      .run();
  const applyWeight = (weight: CoverWeight | null) => {
    const chain = selectionChain();
    if (!chain) return;
    if (weight) chain.unsetBold();
    chain
      .setMark("coverPaint", {
        fontFamily: weight ? effectiveFamily : family,
        fontWeight: weight,
      })
      .run();
  };
  return (
    <CoverFontMenus
      inline
      family={family}
      weight={weight}
      effectiveFamily={effectiveFamily}
      disabled={editor.state.selection.empty}
      onBeforeOpen={remember}
      onFamily={(next) => applyFamily(next ?? null)}
      onWeight={(next) => applyWeight(next ?? null)}
    />
  );
}
