"use client";
import { useEffect } from "react";
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
import { CoverPaint } from "./cover-paint-mark";

export function CoverTextEditor({
  id,
  text,
  doc,
  label,
  onChange,
  placeholder,
  maxLength = 8000,
}: {
  id: string;
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
      StarterKit.configure({
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
    onFocus: ({ editor }) => activate({ id, editor }),
    onUpdate: ({ editor }) => {
      const parsed = coverRichDocSchema.safeParse(
        JSON.parse(JSON.stringify(editor.getJSON())),
      );
      if (parsed.success) onChange(coverDocPlain(parsed.data), parsed.data);
    },
  });
  // Known to the format bar from creation, so it can act before the first focus.
  useEffect(() => {
    if (!editor) return;
    register({ id, editor });
    return () => unregister(editor);
  }, [editor, id, register, unregister]);
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
