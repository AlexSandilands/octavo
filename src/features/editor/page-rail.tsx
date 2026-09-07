"use client";

import { useEffect, useRef } from "react";
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

// The editor's left "Pages" rail: a vertical, drag-to-reorder list of numbered
// page thumbnails separated by rules, plus the "Add page" template menu.
// Reordering uses dnd-kit (same library the block canvas uses); a small drag
// threshold means a plain click on a thumbnail still just selects the page.
// The thumbnails scroll within the rail on a long issue; the label and the Add
// control stay put either side.
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
    <div className="bg-sheet border-hairline flex w-[150px] flex-none flex-col border-r pt-3">
      <span className="small-caps text-grey-soft px-4">Pages</span>
      {/* The gutter is reserved on both edges so a scrollbar never shifts the
          thumbs. */}
      <div
        ref={scrollerRef}
        className="scrollbar-soft scrollbar-soft-quiet mt-2 flex min-h-0 w-full flex-col overflow-y-auto px-3 [scrollbar-gutter:stable_both-edges]"
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

      <div className="rule-heavy flex justify-center px-3 py-3">
        <AddPageMenu
          open={addMenu}
          onToggle={onToggleAddMenu}
          onClose={onCloseAddMenu}
          onAdd={onAddPage}
        />
      </div>
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
      className="rule-hair flex flex-col items-center py-3 first:border-t-0"
    >
      <button
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        aria-label={`${index + 1}`}
        className={`bg-sheet relative block h-[108px] w-[84px] touch-none scroll-my-3 p-2.5 text-left ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${active ? "border-lead border-2" : "border-hairline-strong border"}`}
      >
        {/* Decorative bars standing in for a page's content in the thumbnail
            — a cover motif (title block) vs a text-sheet motif. */}
        {page.cover ? (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <div className="bg-hairline-strong h-1.5 w-[60%]" />
            <div className="bg-hairline-strong h-3 w-[80%]" />
            <div className="bg-hairline mt-1 h-1 w-[45%]" />
          </div>
        ) : (
          <>
            <div className="bg-hairline-strong h-2 w-[80%]" />
            <div className="bg-hairline mt-1.5 h-1 w-[90%]" />
            <div className="bg-hairline mt-1 h-1 w-[70%]" />
          </>
        )}
        <span
          aria-hidden
          className="text-lead absolute top-1 left-1.5 font-ui text-[12px] font-bold tabular-nums"
        >
          {index + 1}
        </span>
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title={`Delete page ${index + 1}`}
          aria-label={`Delete page ${index + 1}`}
          className="text-grey-soft hover:text-red mt-1 flex h-8 cursor-pointer items-center rounded-ui px-2 font-ui text-[13px] font-semibold underline decoration-1 underline-offset-4 transition-colors"
        >
          Delete
        </button>
      )}
    </div>
  );
}
