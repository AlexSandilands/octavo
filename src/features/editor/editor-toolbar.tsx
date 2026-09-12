"use client";

import { MenuSelect } from "@/components/menu-select";
import type { BlockType } from "@/lib/blocks";
import {
  COVER_PRESET_LABELS,
  MAX_COVER_ELEMENTS,
  type CoverElementPreset,
} from "@/lib/cover-elements";
import { BLOCK_KINDS } from "./block-kinds";
import { BarDivider, FloatingBar } from "./floating-bar";
import { ToolButton as Tool } from "./tool-button";
import type { BarLayout } from "./use-bar-layout";
import type { HistoryNotice } from "./use-editor-history";

/** The block kinds a cover takes; the rest belong to interior pages. */
const COVER_KINDS: BlockType[] = ["heading", "text", "image"];

// The editor's tool bar: undo/redo, the block-insert buttons and the cover-page
// toggle. It floats over the foot of the canvas rather than sitting in a strip
// above it (issue #222) — the tools sit beside the end of the page, which is
// where an inserted block lands and where the overflow marker appears; a panned
// page shows through around it. On a cover the insert set narrows to what a
// cover takes and gains the cover details and a logo.
export function EditorToolbar({
  layout,
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
  onAddCoverElement,
  coverElementCount,
}: {
  layout: BarLayout;
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
  onAddCoverElement: (preset: CoverElementPreset) => void;
  coverElementCount: number;
}) {
  const vertical = layout === "vertical";
  const showLabel = layout === "labels";
  const kinds = coverActive
    ? BLOCK_KINDS.filter((b) => COVER_KINDS.includes(b.type))
    : BLOCK_KINDS;
  return (
    <FloatingBar vertical={vertical} side="left" label="Editor tools">
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
      <BarDivider vertical={vertical} />
      {kinds.map((b) => (
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
          showLabel={showLabel}
          disabled={insertDisabled}
          onClick={() => onAddBlock(b.type)}
        />
      ))}
      {coverActive && (
        <>
          {coverElementCount < MAX_COVER_ELEMENTS && (
            <MenuSelect
              label=""
              current="Add detail"
              triggerLabel="Add detail"
              ariaLabel="Cover details"
              value=""
              side="top"
              portal
              items={(["story", "contents", "details"] as const).map(
                (preset) => ({
                  key: preset,
                  value: preset,
                  content: COVER_PRESET_LABELS[preset],
                }),
              )}
              onSelect={(preset) =>
                onAddCoverElement(preset as CoverElementPreset)
              }
            />
          )}
          <Tool
            icon="image"
            label="Logo"
            hint="Add a logo"
            showLabel={showLabel}
            iconClass="text-accent"
            disabled={coverElementCount >= MAX_COVER_ELEMENTS}
            onClick={() => onAddCoverElement("logo")}
          />
        </>
      )}
      {/* The first page is always the cover, so it gets no toggle at all. */}
      {!coverDisabled && (
        <>
          <BarDivider vertical={vertical} />
          <Tool
            icon="doc"
            label="Cover page"
            hint="Lay this page out as a cover"
            showLabel={showLabel}
            pressed={coverActive}
            onClick={onToggleCover}
          />
        </>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {/* Keyed by the counter so the same text twice is still a change. */}
        <span key={notice.n}>{notice.text}</span>
      </span>
    </FloatingBar>
  );
}
