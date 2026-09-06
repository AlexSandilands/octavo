"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import { useQuietScrollbar } from "@/components/use-quiet-scrollbar";
import { type Page, type PageTemplate } from "@/lib/blocks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AddPageMenu } from "./add-page-menu";

// The editor's left "Pages" rail: a vertical, drag-to-reorder list of page
// thumbnails plus the "Add page" template menu. Reordering uses dnd-kit (same
// library the block canvas uses); a small drag threshold means a plain click on
// a thumbnail still just selects the page. The thumbnails scroll within the
// rail on a long issue; the label and the Add control stay put either side.
export function PageRail({
  pages,
  curPage,
  addMenu,
  onSelectPage,
  onReorder,
  onAddPage,
  onDeletePage,
  onToggleAddMenu,
  onCloseAddMenu,
}: {
  pages: Page[];
  curPage: number;
  addMenu: boolean;
  onSelectPage: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddPage: (template: PageTemplate) => void;
  onDeletePage: (index: number) => void;
  onToggleAddMenu: () => void;
  onCloseAddMenu: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  // Keep the page being edited in view: a page reached by any route other than
  // a click on its thumb (add, reorder, delete) may sit outside the scrolled
  // part of the rail.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [curPage]);
  useQuietScrollbar(scrollerRef);

  return (
    <div className="bg-surface border-hairline flex w-[156px] flex-none flex-col items-center border-r py-4">
      <span className="text-fg-muted w-full pl-5 font-ui text-[12px] font-bold tracking-[0.12em] uppercase">
        Pages
      </span>
      {/* Padding replaces the old gaps, so a rail that fits lays out unchanged;
          the gutter is reserved on both edges so a scrollbar never shifts the thumbs. */}
      <div
        ref={scrollerRef}
        className="scrollbar-soft scrollbar-soft-quiet flex min-h-0 w-full flex-col items-center gap-3 overflow-y-auto py-3 [scrollbar-gutter:stable_both-edges]"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={pages.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {pages.map((p, i) => (
              <SortableThumb
                key={p.id}
                page={p}
                index={i}
                active={i === curPage}
                canDelete={pages.length > 1}
                onSelect={() => onSelectPage(i)}
                onDelete={() => onDeletePage(i)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <AddPageMenu
        open={addMenu}
        onToggle={onToggleAddMenu}
        onClose={onCloseAddMenu}
        onAdd={onAddPage}
      />
    </div>
  );
}

function SortableThumb({
  page,
  index,
  active,
  canDelete,
  onSelect,
  onDelete,
}: {
  page: Page;
  index: number;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 40 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      className="group relative"
    >
      <button
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={`bg-page relative block h-[108px] w-[84px] touch-none scroll-my-3 rounded-[8px] p-2.5 text-left transition-[border-color,box-shadow] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${
          active
            ? "border-primary shadow-card border-2"
            : "border-hairline hover:border-edge border"
        }`}
      >
        {/* Decorative skeleton bars standing in for a page's content in the
            thumbnail — a cover motif (title block) vs a text-page motif. One-off
            warm greys, local to this miniature; not part of the token palette. */}
        {page.cover ? (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <div className="h-1.5 w-[60%] rounded-[2px] bg-[#cdbfa0]" />
            <div className="h-3 w-[80%] rounded-[2px] bg-[#c2b596]" />
            <div className="mt-1 h-1 w-[45%] rounded-[2px] bg-[#ddd4c2]" />
          </div>
        ) : (
          <>
            <div className="h-2 w-[80%] rounded-[2px] bg-[#e0d9c9]" />
            <div className="mt-1.5 h-1 w-[90%] rounded-[2px] bg-[#ece6da]" />
          </>
        )}
        <span
          className={`absolute right-1.5 bottom-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-ui text-[11px] font-bold tabular-nums ${
            active ? "bg-primary text-surface" : "bg-surface-2 text-fg-muted"
          }`}
        >
          {index + 1}
        </span>
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          title={`Delete page ${index + 1}`}
          aria-label={`Delete page ${index + 1}`}
          className="bg-surface text-fg-muted hover:text-danger hover:border-danger border-edge shadow-card absolute -top-2.5 -right-2.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Icon name="trash" size={14} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}
