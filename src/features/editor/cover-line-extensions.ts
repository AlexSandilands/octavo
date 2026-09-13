import { Extension, Node, type Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

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
