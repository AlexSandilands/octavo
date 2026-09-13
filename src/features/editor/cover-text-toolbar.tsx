"use client";
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { colorCss, type CoverAppearance } from "@/lib/cover-appearance";
import { coverSelectionIsBold, toggleCoverSelectionBold } from "./cover-bold";
import { useCoverText } from "./cover-text-context";
import { ColorSwatches } from "./cover-color-picker";
import { Segments } from "./cover-segments";
import { SHADOW_OPTIONS } from "./cover-shadow-control";
import { CoverSelectedFont } from "./cover-selected-font";
import { useCoverToolbarBounds } from "./use-cover-toolbar-bounds";
import { CAP_NUDGE, TbBtn } from "./rich-text-editor";

// The floating bar above a selected cover item, for the words inside it: bold,
// italic, underline, a colour and a shadow for the selection only. Whole-item
// styling lives in the inspector; this is the same split the body-text blocks
// make on ordinary pages.
export function CoverTextToolbar({
  appearance,
  italicByDefault = false,
}: {
  /** What the item paints with, so an unpainted selection shows its real colour. */
  appearance: Required<CoverAppearance>;
  /** The cover's tagline style sets its text in italics before any formatting. */
  italicByDefault?: boolean;
}) {
  const { target } = useCoverText();
  const editor = target?.editor;
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState<"colour" | "shadow" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useCoverToolbarBounds(root, Boolean(editor));
  useEffect(() => {
    if (!editor) return;
    const update = () => refresh();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);
  // A tray closes on an outside press or Escape, like the house menus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!editor) return null;

  const paint = editor.getAttributes("coverPaint");
  const italic = paint.fontStyle
    ? paint.fontStyle === "italic"
    : editor.isActive("italic") || italicByDefault;
  const colour = (paint.color as string | undefined) ?? appearance.text;
  const shadow =
    (paint.shadow as typeof appearance.shadow) ?? appearance.shadow;
  const shadowColour =
    (paint.shadowColor as string | undefined) ?? appearance.shadowColor;
  const apply = (attrs: Record<string, string | null>) =>
    editor.chain().focus().setMark("coverPaint", attrs).run();
  const toggle = (tray: "colour" | "shadow") =>
    setOpen((o) => (o === tray ? null : tray));

  return (
    <div
      ref={root}
      data-canvas-chrome
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="Selected text formatting"
      className="border-hair chrome-unscaled absolute bottom-full left-0 z-30 mb-2 flex w-max flex-col gap-1.5 rounded-[8px] border bg-white p-1.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
    >
      <div className="scrollbar-soft flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap [&>*]:shrink-0">
        <CoverSelectedFont editor={editor} font={target.font} />
        <div className="border-hair flex overflow-hidden rounded-[6px] border">
          <TbBtn
            label="B"
            labelClass="font-bold"
            title="Bold"
            active={coverSelectionIsBold(editor.state, target.font)}
            onClick={() =>
              editor
                .chain()
                .focus()
                .command(({ tr }) => toggleCoverSelectionBold(tr, target.font))
                .run()
            }
          />
          <TbBtn
            label="I"
            labelClass="font-serif italic"
            labelFont="serif"
            title="Italic"
            active={italic}
            onClick={() =>
              editor
                .chain()
                .focus()
                .unsetItalic()
                .setMark("coverPaint", {
                  fontStyle: italic ? "normal" : "italic",
                })
                .run()
            }
          />
          <TbBtn
            label="U"
            labelClass="underline"
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleMark("underline").run()}
          />
        </div>
        <span className="bg-line h-5 w-px" />
        <Tray
          title="Text colour"
          open={open === "colour"}
          onClick={() => toggle("colour")}
        >
          {/* The current colour as a swatch; a paper ring keeps it legible
              on the pressed (accent) button. */}
          <span
            aria-hidden
            className="border-hair-warm block h-4 w-4 rounded-full border shadow-[0_0_0_1.5px_var(--color-page)]"
            style={{ background: colorCss(colour) }}
          />
        </Tray>
        <Tray
          title="Text shadow"
          open={open === "shadow"}
          active={shadow !== "none"}
          onClick={() => toggle("shadow")}
        >
          {/* Same cap-height nudge as the bar's other text labels. */}
          <span className={CAP_NUDGE.sans}>Shadow</span>
        </Tray>
        <span className="bg-line h-5 w-px" />
        <TbBtn
          label="Clear"
          title="Clear formatting"
          active={false}
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
        />
      </div>
      {open === "colour" && (
        <div className="border-hair rounded-[6px] border p-2">
          <ColorSwatches
            label="Selected text colour"
            value={colour}
            size={24}
            onChange={(color) => apply({ color })}
          />
        </div>
      )}
      {open === "shadow" && (
        <div className="border-hair w-[236px] space-y-2 rounded-[6px] border p-2">
          <Segments
            compact
            label="Selected text shadow"
            value={shadow}
            options={[...SHADOW_OPTIONS]}
            onChange={(s) => apply({ shadow: s, shadowColor: shadowColour })}
          />
          {shadow !== "none" && (
            <ColorSwatches
              label="Selected text shadow colour"
              value={shadowColour}
              size={24}
              onChange={(c) => apply({ shadow, shadowColor: c })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// A toolbar button that opens a tray below the bar. `active` marks a setting
// that is on for the selection, in the same pressed style as bold or italic.
function Tray({
  title,
  open,
  active = false,
  onClick,
  children,
}: {
  title: string;
  open: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-expanded={open}
      aria-pressed={active || undefined}
      aria-haspopup="true"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-[6px] px-1.5 font-sans text-[12px] font-semibold transition-colors ${
        open || active
          ? "bg-accent text-paper"
          : "text-muted hover:bg-accent-wash hover:text-accent bg-white"
      }`}
    >
      {children}
    </button>
  );
}
