import { useEffect, useReducer } from "react";
import { Button } from "@/components/ui";
import { useCoverText } from "./cover-text-context";
import { CoverColorPicker } from "./cover-color-picker";
import { CoverShadowControl } from "./cover-shadow-control";
import type { CoverAppearance } from "@/lib/cover-appearance";
export function CoverTextFormatControls({
  appearance,
}: {
  appearance: Required<CoverAppearance>;
}) {
  const { target } = useCoverText();
  const editor = target?.editor;
  const [, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const update = () => refresh();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);
  if (!editor)
    return (
      <p className="text-muted font-sans text-xs leading-relaxed">
        Select words on the page to format them individually.
      </p>
    );
  const paint = editor.getAttributes("coverPaint");
  const italic = paint.fontStyle
    ? paint.fontStyle === "italic"
    : editor.isActive("italic") ||
      getComputedStyle(editor.view.dom).fontStyle === "italic";
  const apply = (attrs: Record<string, string | null>) =>
    editor.chain().setMark("coverPaint", attrs).run();
  return (
    <div className="space-y-3" aria-label="Selected text formatting">
      <div className="flex items-center gap-1">
        {[
          {
            label: "Bold",
            text: <b>B</b>,
            active: editor.isActive("bold"),
            run: () => editor.chain().toggleBold().run(),
          },
          {
            label: "Italic",
            text: <i>I</i>,
            active: italic,
            run: () =>
              editor
                .chain()
                .unsetItalic()
                .setMark("coverPaint", {
                  fontStyle: italic ? "normal" : "italic",
                })
                .run(),
          },
          {
            label: "Underline",
            text: <u>U</u>,
            active: editor.isActive("underline"),
            run: () => editor.chain().toggleMark("underline").run(),
          },
        ].map((b) => (
          <Button
            key={b.label}
            size="sm"
            variant={b.active ? "primary" : "secondary"}
            className="flex-1 px-2!"
            aria-label={b.label}
            aria-pressed={b.active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.run}
          >
            {b.text}
          </Button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          className="px-2!"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().unsetAllMarks().run()}
        >
          Reset
        </Button>
      </div>
      <CoverColorPicker
        label="Selected text colour"
        value={paint.color ?? appearance.text}
        onChange={(color) => apply({ color })}
      />
      <CoverShadowControl
        label="Selected text shadow"
        value={paint.shadow ?? appearance.shadow}
        color={paint.shadowColor ?? appearance.shadowColor}
        onChange={(shadow, shadowColor) => apply({ shadow, shadowColor })}
      />
    </div>
  );
}
