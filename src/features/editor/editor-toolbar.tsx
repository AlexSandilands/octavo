"use client";

import { Icon, type IconName } from "@/components/icons";
import type { BlockType } from "@/lib/blocks";
import type { HistoryNotice } from "./use-editor-history";

const INSERT: { type: BlockType; label: string; icon: IconName }[] = [
  { type: "heading", label: "Heading", icon: "heading" },
  { type: "text", label: "Text", icon: "menu" },
  { type: "image", label: "Image", icon: "image" },
  { type: "montage", label: "Montage", icon: "grid" },
  { type: "video", label: "Video", icon: "play" },
  { type: "sponsor", label: "Sponsor", icon: "banner" },
];

/** Stage padding kept below the fitted page, so the floating bar clears it. */
export const TOOLBAR_RESERVE = 24;

// A permanent tool rail beside the page: insertion first, page setup and
// undo history below. Every control remains in normal keyboard tab order.
export function EditorToolbar({
  onAddBlock,
  insertDisabled = false,
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
  /** This page is filled edge to edge by one photo, which owns it (issue #227). */
  insertDisabled?: boolean;
  onToggleCover: () => void;
  coverDisabled: boolean;
  coverActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Announced politely when a shortcut found the history stack empty. */
  notice: HistoryNotice;
}) {
  return (
    <aside
      className="index-editor-tools scrollbar-soft [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]"
      aria-label="Editor tools"
    >
      <div role="group" aria-label="Insert blocks">
        <span className="index-kicker mb-2 text-accent">02 / Insert</span>
        {INSERT.map((b) => (
          <Tool
            key={b.type}
            icon={b.icon}
            label={b.label}
            hint={
              insertDisabled
                ? "This page is filled by a photo"
                : `Insert a ${b.label.toLowerCase()} block`
            }
            iconClass="text-accent"
            showLabel
            disabled={insertDisabled}
            onClick={() => onAddBlock(b.type)}
          />
        ))}
      </div>
      <div role="group" aria-label="Page setup">
        <span className="index-kicker mb-2 text-accent">03 / Page</span>
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
      </div>
      <div role="group" aria-label="History" className="mt-auto">
        <span className="index-kicker mb-2 text-accent">04 / History</span>
        <Tool
          icon="undo"
          label="Undo"
          hint="Undo (Ctrl+Z)"
          shortcut="Control+Z Meta+Z"
          unavailable={!canUndo}
          onClick={onUndo}
          showLabel
        />
        <Tool
          icon="redo"
          label="Redo"
          hint="Redo (Ctrl+Shift+Z)"
          shortcut="Control+Shift+Z Meta+Shift+Z Control+Y"
          unavailable={!canRedo}
          onClick={onRedo}
          showLabel
        />
        <span role="status" aria-live="polite" className="sr-only">
          <span key={notice.n}>{notice.text}</span>
        </span>
      </div>
    </aside>
  );
}

// Its own shape rather than the house Button (§6 allows a bordered icon square):
// a labelled 44px control, plus the aria-pressed and
// aria-keyshortcuts a tool bar owes. The interaction contract is the house one.
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
  /** Show the text label beside the icon. */
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
      className={`flex h-10 w-10 flex-none items-center justify-center gap-1.5 rounded-[9px] border font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none ${showLabel ? "w-auto px-2.5" : ""} ${look}`}
    >
      <Icon name={icon} size={16} className={pressed ? "" : iconClass} />
      {showLabel && <span className="index-tool-label">{label}</span>}
    </button>
  );
}
