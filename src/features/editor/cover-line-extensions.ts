import { Extension, Node, type Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

// Each paragraph's text sits in the reader's `CoverLine` pair, so a panel that
// fits the text bands the lines being typed exactly as it does when read.
export const CoverParagraph = Node.create({
  name: "paragraph",
  priority: 1000,
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => [
    "p",
    ["span", { class: "cover-line" }, ["span", { class: "cover-line-ink" }, 0]],
  ],
});

const gapsKey = new PluginKey<boolean>("coverLineGaps");
/** Whether the field's panel fits its text; only then are the gaps marked. */
export function setCoverLineGaps(editor: Editor, on: boolean) {
  if (!editor.isDestroyed && gapsKey.getState(editor.state) !== on)
    editor.view.dispatch(editor.state.tr.setMeta(gapsKey, on));
}
function gaps(doc: PmNode) {
  const marks: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    // A hard break reads as one character, so offsets stay positions.
    const text = node.textBetween(0, node.content.size, "", "\n");
    for (const m of text.matchAll(/(?<=\S) (?=\S)/g)) {
      const from = pos + 1 + m.index;
      marks.push(Decoration.inline(from, from + 1, { class: "cover-gap" }));
    }
    return false;
  });
  return DecorationSet.create(doc, marks);
}

/** Marks each single space between words. The editor's pre-wrap makes a space
 *  at a soft wrap hang inside its line's band; a fitted panel lets these collapse
 *  there, as the reader's do, so the band ends at the last word. */
export const CoverLineGaps = Extension.create({
  name: "coverLineGaps",
  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: gapsKey,
        state: {
          init: () => false,
          apply: (tr, on) => tr.getMeta(gapsKey) ?? on,
        },
        // The browser types a space beside a collapsing gap as a no-break space;
        // keep the ordinary space typed. Pastes and loaded content stay as given.
        appendTransaction: (trs, before, state) => {
          if (
            !gapsKey.getState(state) ||
            !trs.some(
              (tr) =>
                tr.docChanged &&
                !tr.getMeta("uiEvent") &&
                !tr.getMeta("preventUpdate"),
            )
          )
            return null;
          const from = before.doc.content.findDiffStart(state.doc.content);
          const to = before.doc.content.findDiffEnd(state.doc.content)?.b;
          if (from == null || to == null) return null;
          const tr = state.tr;
          state.doc.nodesBetween(from, Math.max(from, to), (node, pos) => {
            if (!node.isText) return;
            for (const m of node.text!.matchAll(/\u00a0/g))
              tr.replaceWith(
                pos + m.index,
                pos + m.index + 1,
                state.schema.text(" ", node.marks),
              );
          });
          return tr.docChanged ? tr : null;
        },
        props: {
          decorations: (state) =>
            gapsKey.getState(state) ? gaps(state.doc) : null,
        },
      }),
    ];
  },
});

/** The selection the browser is about to replace. ProseMirror learns of a new
 *  selection a beat after the browser makes it (fill(), dictation, autocorrect),
 *  so its own state can still say "caret"; the DOM's is the truth here. */
function pendingSelection(view: EditorView): Selection | null {
  const dom = view.dom.ownerDocument.getSelection();
  if (!dom || dom.isCollapsed || !dom.anchorNode || !dom.focusNode) return null;
  if (!view.dom.contains(dom.anchorNode) || !view.dom.contains(dom.focusNode))
    return null;
  const { doc } = view.state;
  const at = (n: globalThis.Node, o: number) =>
    doc.resolve(Math.max(0, Math.min(doc.content.size, view.posAtDOM(n, o))));
  const found = TextSelection.between(
    at(dom.anchorNode, dom.anchorOffset),
    at(dom.focusNode, dom.focusOffset),
  );
  return found.empty ? null : found;
}

/** Replaces a selection with typed or corrected text through ProseMirror. Left to
 *  the browser, replacing a paragraph's whole text also removes its `cover-line`
 *  spans, and the new text lands outside the editable content and is lost. Text
 *  under composition (an IME) is not cancelable and is not handled here. */
export const CoverReplaceSelection = Extension.create({
  name: "coverReplaceSelection",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            beforeinput: (view, event) => {
              const e = event as InputEvent;
              if (
                e.isComposing ||
                (e.inputType !== "insertText" &&
                  e.inputType !== "insertReplacementText")
              )
                return false;
              const text = e.data ?? e.dataTransfer?.getData("text/plain");
              const selection = view.state.selection.empty
                ? pendingSelection(view)
                : view.state.selection;
              if (!text || !selection) return false;
              e.preventDefault();
              view.dispatch(
                view.state.tr
                  .setSelection(selection)
                  .insertText(text)
                  .scrollIntoView(),
              );
              return true;
            },
          },
        },
      }),
    ];
  },
});
