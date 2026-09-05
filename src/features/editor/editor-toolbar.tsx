"use client";

import { Icon, type IconName } from "@/components/icons";
import type { BlockType } from "@/lib/blocks";

const INSERT: { type: BlockType; label: string; icon: IconName }[] = [
  { type: "heading", label: "Heading", icon: "heading" },
  { type: "text", label: "Text", icon: "menu" },
  { type: "image", label: "Image", icon: "image" },
  { type: "montage", label: "Montage", icon: "grid" },
  { type: "video", label: "Video", icon: "play" },
  { type: "sponsor", label: "Sponsor", icon: "banner" },
];

/** Canvas height the floating bar is given, so the fitted page clears it. */
export const TOOLBAR_RESERVE = 92;

// The editor's tool bar: undo/redo, the block-insert buttons and the cover-page
// toggle. It floats over the foot of the canvas rather than sitting in a strip
// above it (issue #222) — the tools then sit beside the end of the page, which
// is where an inserted block lands, and beside the overflow marker that says a
// block no longer fits. The canvas reserves TOOLBAR_RESERVE below the fitted
// page for it, so at the fitted view it covers no page content at all.
//
// Every target is 40px, always visible (never hover-to-appear) and labelled in
// words as well as by icon.
export function EditorToolbar({
  onAddBlock,
  onToggleCover,
  coverDisabled,
  coverActive,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  notice,
}: {
  onAddBlock: (type: BlockType) => void;
  onToggleCover: () => void;
  coverDisabled: boolean;
  coverActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Announced politely when a shortcut found the history stack empty. */
  notice: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
      {/* A group, not role="toolbar": that role promises arrow-key navigation
          within a single tab stop, and here every button is its own ordinary
          tab stop. */}
      <div
        role="group"
        aria-label="Editor tools"
        className="border-hair-warm pointer-events-auto flex max-w-full items-center gap-2 rounded-[14px] border bg-white px-2.5 py-2 shadow-[0_8px_28px_rgba(40,36,28,0.22)]"
      >
        {/* Nothing left to undo doesn't take the button out of the tab order —
            it would throw focus to <body> under the hands of whoever just
            pressed it to the end of the stack (issue #131). */}
        <Tool
          icon="undo"
          label="Undo"
          hint="Undo (Ctrl+Z)"
          shortcut="Control+Z Meta+Z"
          unavailable={!canUndo}
          onClick={onUndo}
        />
        <Tool
          icon="redo"
          label="Redo"
          hint="Redo (Ctrl+Shift+Z)"
          shortcut="Control+Shift+Z Meta+Shift+Z Control+Y"
          unavailable={!canRedo}
          onClick={onRedo}
        />
        <Divider />
        {INSERT.map((b) => (
          <Tool
            key={b.type}
            icon={b.icon}
            label={b.label}
            hint={`Insert a ${b.label.toLowerCase()} block`}
            iconClass="text-accent"
            showLabel
            onClick={() => onAddBlock(b.type)}
          />
        ))}
        <Divider />
        <Tool
          icon="doc"
          label="Cover page"
          hint={
            coverDisabled
              ? "The first page is always the cover"
              : "Lay this page out as a cover"
          }
          showLabel
          pressed={coverActive}
          disabled={coverDisabled}
          onClick={onToggleCover}
        />
        <span role="status" aria-live="polite" className="sr-only">
          {notice}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="bg-line mx-0.5 h-6 w-px" />;
}

// Its own shape rather than the house Button: a 40px square for the icon-only
// controls, plus the aria-pressed / aria-keyshortcuts a tool bar owes. The
// interaction contract is the house one — pointer cursor, hover feedback, a
// press, and a disabled state that promises nothing on hover.
function Tool({
  icon,
  label,
  hint,
  shortcut,
  iconClass = "",
  showLabel = false,
  pressed,
  disabled = false,
  unavailable = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint: string;
  shortcut?: string;
  iconClass?: string;
  showLabel?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  /** Off, but still focusable — see the note at the undo button. */
  unavailable?: boolean;
  onClick: () => void;
}) {
  const inert = disabled || unavailable;
  const look = inert
    ? "border-hair-warm text-ink cursor-default bg-white opacity-45"
    : pressed
      ? "border-accent bg-accent text-paper cursor-pointer motion-safe:active:scale-95"
      : "border-hair-warm text-ink hover:border-accent hover:bg-accent-wash cursor-pointer bg-white motion-safe:active:scale-95";
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      title={hint}
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      className={`flex h-10 flex-none items-center justify-center gap-1.5 rounded-[9px] border font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none ${showLabel ? "px-3.5" : "w-10"} ${look}`}
    >
      <Icon name={icon} size={16} className={pressed ? "" : iconClass} />
      {showLabel && label}
    </button>
  );
}
