import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import type { Block } from "@/lib/blocks";
import { type RichDoc, stringToDoc } from "@/lib/rich-text-doc";
import { Underline } from "../rich-text-marks";

type TextBlock = Extract<Block, { type: "text" }>;
export function ReviewText({
  block,
  onChange,
}: {
  block: TextBlock;
  onChange: (block: TextBlock) => void;
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
        bulletList: false,
        orderedList: false,
      }),
      Underline,
    ],
    content:
      typeof block.text === "string" ? stringToDoc(block.text) : block.text,
    editorProps: {
      attributes: {
        class: "rich-text min-h-20 outline-none",
        role: "textbox",
        "aria-label": "Editable text preview",
      },
    },
    onUpdate: ({ editor }) => {
      // Keep all preview edits; synthesis validates and splits the accepted batch.
      onChange({
        ...block,
        text: JSON.parse(JSON.stringify(editor.getJSON())) as RichDoc,
      });
    },
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label="Bold preview text"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-label="Italic preview text"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-label="Underline preview text"
          onClick={() => editor?.chain().focus().toggleMark("underline").run()}
        >
          Underline
        </Button>
        <MenuSelect
          label="Size"
          ariaLabel="Preview text size"
          current={block.size ?? "m"}
          value={block.size ?? "m"}
          items={(["s", "m", "l", "xl"] as const).map((value) => ({
            key: value,
            value,
            content: value,
          }))}
          onSelect={(size) => onChange({ ...block, size })}
        />
        <MenuSelect
          label="Align"
          ariaLabel="Preview text alignment"
          current={block.align ?? "left"}
          value={block.align ?? "left"}
          items={(["left", "center", "right", "justify"] as const).map(
            (value) => ({ key: value, value, content: value }),
          )}
          onSelect={(align) => onChange({ ...block, align })}
        />
      </div>
      <div
        className="border-hair rounded border p-2 font-serif"
        style={{ textAlign: block.align }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
