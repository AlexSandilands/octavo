"use client";

import { Icon } from "@/components/icons";
import { PAGE_TEMPLATES, type Page, type PageTemplate } from "@/lib/blocks";
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

// The editor's left "Pages" rail: a vertical, drag-to-reorder list of page
// thumbnails plus the "Add page" template menu. Reordering uses dnd-kit (same
// library the block canvas uses); a small drag threshold means a plain click on
// a thumbnail still just selects the page.
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

  return (
    <div className="bg-paper border-line flex w-[150px] flex-none flex-col items-center gap-3 border-r py-4">
      <span className="text-faint w-full pl-[18px] font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">
        Pages
      </span>
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

      <div className="relative">
        <button
          onClick={onToggleAddMenu}
          aria-expanded={addMenu}
          className="text-faint hover:border-accent hover:text-accent border-dash flex h-10 w-[84px] items-center justify-center gap-1.5 rounded-[3px] border-[1.5px] border-dashed font-sans text-[11px] font-semibold"
        >
          <Icon name="plus" size={14} strokeWidth={1.8} />
          Add
        </button>
        {addMenu && (
          <>
            {/* Click-off backdrop */}
            <div className="fixed inset-0 z-20" onClick={onCloseAddMenu} />
            <div className="bg-card border-hair-warm absolute top-0 left-[92px] z-30 w-56 overflow-hidden rounded-lg border shadow-[0_12px_32px_rgba(40,36,28,0.18)]">
              {PAGE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onAddPage(t.id)}
                  className="hover:bg-accent-wash block w-full px-3.5 py-2.5 text-left"
                >
                  <div className="text-ink font-sans text-[13px] font-semibold">
                    {t.label}
                  </div>
                  <div className="text-faint2 mt-0.5 font-sans text-[11px] leading-snug">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
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
      className="group relative"
    >
      <button
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={`bg-page relative block h-[108px] w-[84px] touch-none rounded-[3px] p-2.5 text-left ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${
          active
            ? "border-accent border-2 shadow-[0_2px_6px_rgba(40,36,28,0.12)]"
            : "border border-hair-warm"
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
        <span className="text-faint absolute right-2 bottom-1.5 font-sans text-[9px] font-semibold">
          {index + 1}
        </span>
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          title={`Delete page ${index + 1}`}
          aria-label={`Delete page ${index + 1}`}
          className="bg-paper text-faint2 hover:text-warn hover:border-warn border-hair-warm absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Icon name="trash" size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
