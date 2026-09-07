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

// The editor's tool row, under the header: the block-insert buttons and the
// cover-page toggle at the left, Undo / Redo at the right — every one a word
// with its icon, on a ruled strip rather than a floating pill.
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
    // A group, not role="toolbar": that role promises arrow-key navigation
    // within one tab stop, and here every button is its own tab stop.
    <div
      role="group"
      aria-label="Editor tools"
      className="border-hairline bg-sheet flex flex-none flex-wrap items-center gap-2 border-b px-5 py-2"
    >
      <span className="small-caps text-grey-soft mr-1">Insert</span>
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
        pressed={coverActive}
        disabled={coverDisabled}
        onClick={onToggleCover}
      />
      <span className="ml-auto flex items-center gap-2">
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
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {/* Keyed by the counter so the same text twice is still a change. */}
        <span key={notice.n}>{notice.text}</span>
      </span>
    </div>
  );
}

function Divider() {
  return <span className="bg-hairline-strong mx-1 h-6 w-px" />;
}

// Its own shape rather than the house Button (§6 allows it): a 40px labelled
// chip that also carries the aria-pressed and aria-keyshortcuts a tool row
// owes. The interaction contract is the house one.
function Tool({
  icon,
  label,
  hint,
  shortcut,
  pressed,
  disabled = false,
  unavailable = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  /** Off, but still focusable — see the note at the undo button. */
  unavailable?: boolean;
  onClick: () => void;
}) {
  const inert = disabled || unavailable;
  const look = inert
    ? "border-lead text-lead bg-sheet cursor-default opacity-45"
    : pressed
      ? "border-lead bg-lead text-sheet cursor-pointer"
      : "border-lead text-lead bg-sheet hover:bg-newsprint cursor-pointer";
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      title={hint}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      className={`flex h-10 flex-none items-center gap-1.5 rounded-ui border px-3 font-ui text-[14px] font-semibold whitespace-nowrap transition-[background-color,border-color,color] duration-150 ease-out select-none motion-safe:active:translate-y-px ${look}`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}
