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

/** Breathing room below the fitted page; tools live in their own side panel. */
export const TOOLBAR_RESERVE = 24;

// Persistent labelled tools keep insertion, history and page settings in reach.
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
    <aside className="harbour-insert-panel scrollbar-soft border-line overflow-y-auto [scrollbar-gutter:stable] [--scrollbar-surface:var(--color-card)] flex w-[210px] flex-none flex-col border-l bg-white p-5">
      <h2 className="text-ink text-lg font-semibold">Build your page</h2>
      <p className="text-muted mt-1 mb-5 text-sm">
        Choose what to add, then edit it on the page.
      </p>
      {/* A group, not role="toolbar": that role promises arrow-key navigation
          within one tab stop, and here every button is its own tab stop. */}
      <div
        role="group"
        aria-label="Editor tools"
        className="flex flex-col gap-3"
      >
        {/* `unavailable`, not `disabled`: it keeps the button focusable — see
            `unavailable` in `ui.tsx`. */}
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
          {/* Keyed by the counter so the same text twice is still a change. */}
          <span key={notice.n}>{notice.text}</span>
        </span>
      </div>
    </aside>
  );
}

function Divider() {
  return <span className="bg-line my-1 h-px w-full" />;
}

// Shares the button feedback contract and adds editor-specific ARIA states.
function Tool({
  icon,
  label,
  hint,
  shortcut,
  iconClass = "",
  showLabel = true,
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
  /** Keep the tool name visible beside its icon. */
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
      className={`flex h-11 w-full flex-none items-center justify-start px-3 gap-1.5 rounded-[9px] border font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none  ${look}`}
    >
      <Icon name={icon} size={16} className={pressed ? "" : iconClass} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
