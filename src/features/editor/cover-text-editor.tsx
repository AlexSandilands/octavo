"use client";
import { DEFAULT_FONT_CONTEXT, type CoverFontContext } from "@/lib/cover-fonts";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Editor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import {
  coverDocFor,
  coverDocPlain,
  coverRichDocSchema,
  type CoverRichDoc,
} from "@/lib/cover-rich-text";
import { useCoverText } from "./cover-text-context";
import { Underline } from "./rich-text-marks";
import { CoverBoldShortcuts, setCoverBoldFont } from "./cover-bold";
import { CoverPaint } from "./cover-paint-mark";
import {
  CoverLineGaps,
  CoverParagraph,
  CoverReplaceSelection,
  setCoverLineGaps,
} from "./cover-line-extensions";

type Live = {
  id: string;
  maxLength: number;
  activate: (target: {
    id: string;
    editor: Editor;
    font: CoverFontContext;
  }) => void;
  font: CoverFontContext;
  onChange: (text: string, doc: CoverRichDoc) => void;
};
type Held = { editor: Editor; live: Live; refocus: boolean; timer?: number };

// Editors outlive the component that shows them for a moment: a cover's first
// edit switches its layout, which remounts every field, and a fresh editor there
// would drop the caret and the field's own undo history. The next mount takes the
// same editor back and, if it held focus, puts focus and caret back.
const held = new Map<string, Held>();
const GRACE_MS = 300;

const fieldAttributes = (label: string, placeholder?: string) => ({
  class: "cover-text-editor outline-none",
  role: "textbox",
  "aria-label": label,
  "data-placeholder": placeholder ?? label,
});

function acquire(
  key: string,
  label: string,
  placeholder: string | undefined,
  initial: () => unknown,
  live: Live,
): Held {
  const found = held.get(key);
  if (found && !found.editor.isDestroyed) {
    window.clearTimeout(found.timer);
    found.timer = undefined;
    found.live = live;
    return found;
  }
  const entry: Held = {
    editor: undefined as unknown as Editor,
    live,
    refocus: false,
  };
  entry.editor = new Editor({
    extensions: [
      CoverBoldShortcuts.configure({ font: live.font }),
      Extension.create({
        name: "coverLength",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              filterTransaction: (tr) =>
                !tr.docChanged ||
                tr.doc.textBetween(0, tr.doc.content.size, "\n").length <=
                  entry.live.maxLength,
            }),
          ];
        },
      }),
      CoverParagraph,
      CoverLineGaps,
      CoverReplaceSelection,
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
      Underline,
      CoverPaint,
    ],
    content: initial() as never,
    editorProps: { attributes: fieldAttributes(label, placeholder) },
    onFocus: ({ editor }) =>
      entry.live.activate({ id: entry.live.id, editor, font: entry.live.font }),
    onUpdate: ({ editor }) => {
      const parsed = coverRichDocSchema.safeParse(
        JSON.parse(JSON.stringify(editor.getJSON())),
      );
      if (parsed.success)
        entry.live.onChange(coverDocPlain(parsed.data), parsed.data);
    },
  });
  held.set(key, entry);
  return entry;
}

function release(key: string, entry: Held) {
  // Kept if set: a strict-mode remount releases again after focus is gone.
  entry.refocus ||= entry.editor.view.hasFocus();
  entry.timer = window.setTimeout(() => {
    if (held.get(key) === entry) held.delete(key);
    entry.editor.destroy();
  }, GRACE_MS);
}

function takeRefocus(key: string, editor: Editor) {
  const entry = held.get(key);
  if (!entry || entry.editor !== editor || !entry.refocus) return false;
  entry.refocus = false;
  return true;
}

export function CoverTextEditor({
  id,
  holdKey,
  text,
  doc,
  label,
  onChange,
  placeholder,
  maxLength = 8000,
  font = DEFAULT_FONT_CONTEXT,
  fitLines = false,
}: {
  id: string;
  /** Names the field on the canvas, so its editor survives a remount (a cover's
   *  first edit switches layout). Never shared by two mounted fields. */
  holdKey?: string;
  /** The field's panel fits its text (see CoverLineGaps). */
  fitLines?: boolean;
  font?: CoverFontContext;
  text: string;
  doc?: CoverRichDoc;
  label: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (text: string, doc: CoverRichDoc) => void;
}) {
  const { activate, register, unregister } = useCoverText();
  const ownKey = useId();
  const key = holdKey ?? ownKey;
  const live = useRef<Live>({ id, maxLength, activate, font, onChange });
  useLayoutEffect(() => {
    live.current = { id, maxLength, activate, font, onChange };
    const entry = held.get(key);
    if (entry) entry.live = live.current;
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  useLayoutEffect(() => {
    const entry = acquire(
      key,
      label,
      placeholder,
      () => coverDocFor(text, doc),
      live.current,
    );
    setEditor(entry.editor);
    return () => {
      setEditor(null);
      release(key, entry);
    };
    // The editor is made once per field; later props reach it through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // The inspector's one field is reused as the selection moves between items.
  useEffect(() => {
    editor?.setOptions({
      editorProps: { attributes: fieldAttributes(label, placeholder) },
    });
  }, [editor, label, placeholder]);
  // Once EditorContent has put the element back in: focus and caret return.
  useEffect(() => {
    if (editor && takeRefocus(key, editor)) editor.commands.focus();
  }, [editor, key]);
  const { family, weight } = font;
  useEffect(() => {
    if (!editor) return;
    setCoverBoldFont(editor, { family, weight });
  }, [editor, family, weight]);
  useEffect(() => {
    if (editor) setCoverLineGaps(editor, fitLines);
  }, [editor, fitLines]);
  // Known to the format bar from creation, so it can act before the first focus.
  useEffect(() => {
    if (!editor) return;
    register({ id, editor, font: { family, weight } });
    return () => unregister(editor);
  }, [editor, id, register, unregister, family, weight]);
  // Sidebar edits and history can change a field without remounting the element.
  useEffect(() => {
    if (!editor) return;
    const next = coverDocFor(text, doc);
    const current = coverRichDocSchema.safeParse(editor.getJSON());
    if (
      !current.success ||
      JSON.stringify(current.data) !== JSON.stringify(next)
    )
      editor.commands.setContent(next, false);
  }, [editor, text, doc]);
  return <EditorContent editor={editor} className="cover-rich-editor" />;
}
