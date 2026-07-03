"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Icon } from "@/components/icons";
import {
  TEXT_SIZES,
  textSizePx,
  type BlockPatch,
  type TextSize,
} from "@/lib/blocks";
import { externalHref, richTextToHtml } from "@/lib/rich-text";
import { Underline, Link } from "./rich-text-marks";

// The editing surface for a body-text block. A Tiptap editor styled to match the
// reader's themed paragraph exactly, with a floating toolbar (text size, bold,
// italic, underline, lists, link) shown while the block is selected. Output is
// the constrained HTML the reader sanitises and renders — see
// src/lib/rich-text.ts. Editor-only (client), so Tiptap never reaches the reader
// bundle; the read-only path renders sanitised HTML directly in BlockView.
export function RichTextEditor({
  value,
  size,
  selected,
  onChange,
}: {
  value: string;
  size: TextSize;
  selected: boolean;
  onChange: (patch: BlockPatch) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
      Underline,
      Link,
    ],
    // Seed once from the stored value (sanitised). The editor is uncontrolled
    // afterwards, so autosave re-renders never reset the caret.
    content: richTextToHtml(value),
    editorProps: {
      attributes: {
        class: "rich-text outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange({ text: editor.getHTML() }),
  });

  return (
    <div className="relative">
      {selected && editor && (
        <Toolbar editor={editor} size={size} onChange={onChange} />
      )}
      <div
        // While selected, show the normal text caret instead of the block's
        // pointer cursor; unselected blocks keep the pointer (click to select).
        className={`text-body font-serif ${selected ? "cursor-text" : ""}`}
        style={{ fontSize: textSizePx(size), lineHeight: 1.62 }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  size,
  onChange,
}: {
  editor: Editor;
  size: TextSize;
  onChange: (patch: BlockPatch) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const openLink = () => {
    setLinkValue((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const raw = linkValue.trim();
    // Upgrade scheme-less URLs (example.com → https://example.com) and reject
    // anything that can't be a safe link, so the stored href always survives
    // the reader's sanitiser.
    const href = externalHref(raw);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetMark("link").run();
    } else if (editor.state.selection.empty) {
      // No selection: insert the URL (as typed) as its own linked text.
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${href.replace(/"/g, "&quot;")}">${raw}</a> `)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setMark("link", { href })
        .run();
    }
    setLinkOpen(false);
  };

  return (
    <div className="border-hair absolute bottom-full left-0 z-20 mb-2 flex flex-col gap-1.5 rounded-[8px] border bg-white p-1.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <div className="border-hair flex overflow-hidden rounded-[6px] border">
          {TEXT_SIZES.map((s) => (
            <TbBtn
              key={s.value}
              label={s.label}
              title={`Text size ${s.label}`}
              active={size === s.value}
              onClick={() => onChange({ size: s.value })}
            />
          ))}
        </div>
        <span className="bg-line h-5 w-px" />
        <TbBtn
          label="B"
          labelClass="font-bold"
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <TbBtn
          label="I"
          labelClass="font-serif italic"
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <TbBtn
          label="U"
          labelClass="underline"
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleMark("underline").run()}
        />
        <span className="bg-line h-5 w-px" />
        <TbBtn
          icon="listBullet"
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <TbBtn
          label="1."
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <span className="bg-line h-5 w-px" />
        <TbBtn
          icon="link"
          title="Link"
          active={editor.isActive("link") || linkOpen}
          onClick={openLink}
        />
      </div>

      {linkOpen && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="url"
            value={linkValue}
            placeholder="https://…"
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                setLinkOpen(false);
              }
            }}
            className="border-hair text-body h-7 w-52 rounded-[6px] border px-2 font-sans text-[12px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyLink}
            className="bg-accent text-paper h-7 rounded-[6px] px-2.5 font-sans text-[11px] font-semibold"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function TbBtn({
  label,
  labelClass,
  icon,
  title,
  active,
  onClick,
}: {
  label?: string;
  labelClass?: string;
  icon?: "listBullet" | "link";
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // Keep the editor's selection while clicking a formatting control.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 min-w-7 items-center justify-center px-1.5 font-sans text-[12px] font-semibold ${
        active
          ? "bg-accent text-paper"
          : "text-muted hover:bg-[#f4f8f5] hover:text-accent bg-white"
      }`}
    >
      {icon ? (
        <Icon name={icon} size={15} />
      ) : (
        <span className={labelClass}>{label}</span>
      )}
    </button>
  );
}
