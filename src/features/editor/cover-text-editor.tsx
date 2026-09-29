"use client";
import { DEFAULT_FONT_CONTEXT, type CoverFontContext } from "@/lib/cover-fonts";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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

// A cover with no placement (older ones) switches layout on its first edit, which
// remounts its fields. The field that held the caret leaves its place here and
// the remount takes it straight back.
const CARET_SLOT_MS = 1000;
let caretSlot: {
  key: string;
  from: number;
  to: number;
  at: number;
} | null = null;

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
  /** Names a canvas field, so the caret can follow it across a remount. */
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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      CoverBoldShortcuts.configure({ font }),
      Extension.create({
        name: "coverLength",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              filterTransaction: (tr) =>
                !tr.docChanged ||
                tr.doc.textBetween(0, tr.doc.content.size, "\n").length <=
                  maxLength,
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
    content: coverDocFor(text, doc),
    editorProps: {
      attributes: {
        class: "cover-text-editor outline-none",
        role: "textbox",
        "aria-label": label,
        "data-placeholder": placeholder ?? label,
      },
    },
    onFocus: ({ editor }) => activate({ id, editor, font }),
    onUpdate: ({ editor }) => {
      const parsed = coverRichDocSchema.safeParse(
        JSON.parse(JSON.stringify(editor.getJSON())),
      );
      if (parsed.success) onChange(coverDocPlain(parsed.data), parsed.data);
    },
  });
  const focused = useRef(false);
  useEffect(() => {
    if (!editor || !holdKey) return;
    const slot = caretSlot;
    if (slot?.key !== holdKey) return;
    caretSlot = null;
    if (Date.now() - slot.at > CARET_SLOT_MS) return;
    const max = editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .setTextSelection({
        from: Math.min(slot.from, max),
        to: Math.min(slot.to, max),
      })
      .run();
  }, [editor, holdKey]);
  // Leaving while focused (not just blurred) is what a remount looks like.
  useLayoutEffect(() => {
    if (!editor || !holdKey) return;
    const onFocus = () => (focused.current = true);
    const onBlur = () => (focused.current = false);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
      if (focused.current && !editor.isDestroyed) {
        const { from, to } = editor.state.selection;
        caretSlot = { key: holdKey, from, to, at: Date.now() };
      }
    };
  }, [editor, holdKey]);
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
