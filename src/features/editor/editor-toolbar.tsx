"use client";

import { Icon, type IconName } from "@/components/icons";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import type { BlockType } from "@/lib/blocks";
import {
  MAX_COVER_ELEMENTS,
  type CoverElementType,
} from "@/lib/cover-elements";
import { BLOCK_KINDS } from "./block-kinds";
import { BarDivider, FloatingBar } from "./floating-bar";
import { ToolButton as Tool } from "./tool-button";
import type { BarLayout } from "./use-bar-layout";
import type { HistoryNotice } from "./use-editor-history";

/** The block kinds a cover takes; the rest belong to interior pages. */
const COVER_KINDS: BlockType[] = ["heading", "text", "image"];

/** What the cover's Text menu offers; "" is the unset value no option carries. */
type TextChoice = "" | "paragraph" | "story" | "details";

// The editor's tool bar: undo/redo, the block-insert buttons and the cover-page
// toggle. It floats over the foot of the canvas rather than sitting in a strip
// above it (issue #222) — the tools sit beside the end of the page, which is
// where an inserted block lands and where the overflow marker appears; a panned
// page shows through around it. On a cover the insert set narrows to what a
// cover takes, Text unfolds into the cover's own text items, and a logo joins it.
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
  onTogglePosition,
  onReserveChange,
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
  onTogglePosition: () => void;
  onReserveChange: (reserve: number) => void;
  /** Announced politely when a shortcut found the history stack empty. */
  notice: HistoryNotice;
  onAddCoverElement: (type: CoverElementType) => void;
  coverElementCount: number;
}) {
  const vertical = layout === "vertical";
  const showLabel = layout === "labels";
  const positionLabel = vertical
    ? "Move toolbar to bottom"
    : "Move toolbar to left";
  const kinds = coverActive
    ? BLOCK_KINDS.filter((b) => COVER_KINDS.includes(b.type))
    : BLOCK_KINDS;
  return (
    <FloatingBar
      vertical={vertical}
      side="left"
      label="Editor tools"
      wrap={!vertical}
      onReserveChange={onReserveChange}
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
      <BarDivider vertical={vertical} />
      {kinds.map((b) =>
        coverActive && b.type === "text" ? (
          <CoverTextMenu
            key={b.type}
            icon={b.icon}
            atCapacity={coverElementCount >= MAX_COVER_ELEMENTS}
            onAddBlock={onAddBlock}
            onAddCoverElement={onAddCoverElement}
          />
        ) : (
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
        ),
      )}
      {coverActive && (
        <Tool
          icon="image"
          label="Logo"
          hint="Add a logo"
          showLabel={showLabel}
          iconClass="text-accent"
          disabled={coverElementCount >= MAX_COVER_ELEMENTS}
          onClick={() => onAddCoverElement("logo")}
        />
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
      <BarDivider vertical={vertical} />
      <Tool
        icon={vertical ? "toolbarBottom" : "toolbarLeft"}
        label={positionLabel}
        hint={positionLabel}
        onClick={onTogglePosition}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {/* Keyed by the counter so the same text twice is still a change. */}
        <span key={notice.n}>{notice.text}</span>
      </span>
    </FloatingBar>
  );
}

/** On a cover, Text is a menu: an ordinary paragraph, or one of the cover's own
 *  text items. The cover items drop out at the element cap; a paragraph never does. */
function CoverTextMenu({
  icon,
  atCapacity,
  onAddBlock,
  onAddCoverElement,
}: {
  icon: IconName;
  atCapacity: boolean;
  onAddBlock: (type: BlockType) => void;
  onAddCoverElement: (type: CoverElementType) => void;
}) {
  const items: MenuSelectItem<TextChoice>[] = [
    { key: "paragraph", value: "paragraph", content: "Paragraph" },
    ...(atCapacity
      ? []
      : ([
          { key: "story", value: "story", content: "Story" },
          { key: "details", value: "details", content: "Details" },
        ] as const)),
  ];
  return (
    <MenuSelect<TextChoice>
      label=""
      current="Text"
      triggerLabel="Text"
      ariaLabel="Text"
      icon={<Icon name={icon} size={16} className="text-accent" />}
      value=""
      side="top"
      portal
      items={items}
      onSelect={(choice) => {
        if (choice === "paragraph") onAddBlock("text");
        else if (choice) onAddCoverElement(choice);
      }}
    />
  );
}
