"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon, type IconName } from "@/components/icons";
import { BlockView, type Theme } from "@/features/blocks/block-view";
import type { Block } from "@/lib/blocks";

// One block in the editor canvas: the themed BlockView (editable) wrapped in the
// editing chrome — a faint hover outline, a darker selected outline, a left
// drag handle for reordering, and the selected block's type label + controls.
// Reordering uses dnd-kit, so the other blocks slide out of the way as you drag.
export function EditorBlock({
  block,
  theme,
  selected,
  onSelect,
  onChange,
  onMove,
  onRemove,
}: {
  block: Block;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Record<string, string>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={(e) => {
        // Keep the click from reaching the canvas, which deselects.
        e.stopPropagation();
        onSelect();
      }}
      onFocus={onSelect}
      // A box-shadow "ring" (not outline) so the gap to the text is stable and
      // hover/selected states are pure CSS. The inner page-coloured ring is the
      // breathing room; the outer ring is the visible line.
      className={`group relative cursor-pointer rounded-sm transition-[box-shadow] ${
        isDragging
          ? "z-30 [box-shadow:0_0_0_2px_var(--color-accent),0_12px_28px_rgba(40,36,28,0.22)]"
          : selected
            ? "[box-shadow:0_0_0_6px_var(--color-page),0_0_0_8px_var(--color-accent)]"
            : "hover:[box-shadow:0_0_0_6px_var(--color-page),0_0_0_8px_var(--color-hair)]"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        className={`absolute top-1/2 -left-9 z-10 flex h-7 w-6 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-[5px] border border-[#e0d9c9] bg-white text-muted transition-opacity active:cursor-grabbing ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <Icon name="grip" size={15} />
      </button>

      {selected && (
        <>
          <span className="bg-accent text-paper absolute bottom-full left-0 z-10 mb-2 rounded-[3px] px-1.5 py-[3px] font-sans text-[9px] font-semibold tracking-[0.1em] uppercase">
            {block.type}
          </span>
          <div className="absolute top-1/2 -right-9 z-10 flex -translate-y-1/2 flex-col gap-1">
            <Ctrl icon="arrowUp" title="Move up" onClick={() => onMove(-1)} />
            <Ctrl icon="arrowDown" title="Move down" onClick={() => onMove(1)} />
            <Ctrl icon="trash" title="Delete" danger onClick={onRemove} />
          </div>
        </>
      )}

      <BlockView block={block} theme={theme} edit={{ onChange }} />
    </div>
  );
}

function Ctrl({
  icon,
  title,
  onClick,
  danger,
}: {
  icon: IconName;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={`flex h-6 w-6 items-center justify-center rounded-[5px] border border-[#e0d9c9] bg-white ${
        danger
          ? "text-warn hover:border-warn"
          : "text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <Icon name={icon} size={13} strokeWidth={1.9} />
    </button>
  );
}
