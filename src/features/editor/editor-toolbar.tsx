"use client";

import type { BlockType } from "@/lib/blocks";
import { BLOCK_KINDS } from "./block-kinds";
import { ToolButton as Tool } from "./tool-button";
import type { HistoryNotice } from "./use-editor-history";

/** Stage padding kept below the fitted page, so the floating bar clears it. */
export const TOOLBAR_RESERVE = 92;

// The editor's tool bar: undo/redo, the block-insert buttons and the cover-page
// toggle. It floats over the foot of the canvas rather than sitting in a strip
// above it (issue #222) — the tools sit beside the end of the page, which is
// where an inserted block lands and where the overflow marker appears; a panned
// page shows through around it. Every target is 40px and always visible; labels
// come in from `xl`, where the pill has room.
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
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
      {/* A group, not role="toolbar": that role promises arrow-key navigation
          within one tab stop, and here every button is its own tab stop. */}
      <div
        role="group"
        aria-label="Editor tools"
        className="border-hair-warm pointer-events-auto flex max-w-full items-center gap-2 rounded-[14px] border bg-white px-2.5 py-2 shadow-[0_8px_28px_rgba(40,36,28,0.22)]"
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
        {BLOCK_KINDS.map((b) => (
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
    </div>
  );
}

function Divider() {
  return <span className="bg-line mx-0.5 h-6 w-px" />;
}
