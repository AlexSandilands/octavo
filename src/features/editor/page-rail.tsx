"use client";

import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { useQuietScrollbar } from "@/components/use-quiet-scrollbar";
import { type Page, type PageTemplate } from "@/lib/blocks";
import type { CoverSource } from "@/lib/cover-elements";
import { PageThumb } from "@/features/blocks/page-thumb";
import { PAGE_H, PAGE_W } from "@/features/blocks/page-frame";
import type { MeasurementOptions } from "./pdf-import/measure";
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
// Each thumbnail is a live miniature of the unsaved page (issue #54).
export function PageRail({
  pages,
  look,
  sources,
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
  /** What the canvas renders a page against; the thumbnails use the same. */
  look: MeasurementOptions;
  sources: CoverSource[];
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

  // The miniatures trail the edit: typing re-renders the canvas first, and the
  // one changed thumbnail catches up in a background render.
  const shown = useDeferredValue(pages);
  const shownById = useMemo(
    () => new Map(shown.map((p) => [p.id, p])),
    [shown],
  );
  // The cover's sources are rebuilt on every edit; keep the last list while it
  // reads the same, so typing on an interior page leaves the cover's thumb be.
  const [sameSources, setSameSources] = useState(sources);
  if (sameSources !== sources && !equalSources(sameSources, sources))
    setSameSources(sources);
  const shownSources = useDeferredValue(sameSources);

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
    <div className="bg-paper border-line flex w-[110px] lg:w-[150px] flex-none flex-col items-center border-r py-4">
      <span className="text-faint w-full pl-[18px] font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">
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
                thumb={
                  <RailMiniature
                    page={shownById.get(p.id) ?? p}
                    pageNo={i + 1}
                    {...look}
                    sources={p.coverElements?.length ? shownSources : undefined}
                  />
                }
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

// Memoised so an edit re-renders only the page it changed: the editor keeps an
// untouched page's object, and the look's fields are stable between edits.
const RailMiniature = memo(function RailMiniature(
  props: MeasurementOptions & {
    page: Page;
    pageNo: number;
    sources?: CoverSource[];
  },
) {
  return <PageThumb {...props} width={THUMB_W} side="left" marked={false} />;
});

const THUMB_W = 84;

const equalSources = (a: CoverSource[], b: CoverSource[]) =>
  a.length === b.length &&
  a.every(
    (s, i) =>
      s.id === b[i]!.id &&
      s.pageId === b[i]!.pageId &&
      s.pageNo === b[i]!.pageNo &&
      s.title === b[i]!.title,
  );

function SortableThumb({
  page,
  index,
  active,
  thumb,
  canDelete,
  onSelect,
  onDelete,
}: {
  page: Page;
  index: number;
  active: boolean;
  thumb: React.ReactNode;
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
        // The visible thumbnail is decorative and the number beside it is 9px,
        // so the button says what it is.
        aria-label={`Page ${index + 1}${page.cover ? " (cover)" : ""}`}
        aria-current={active ? "page" : undefined}
        // Sized to the page's own proportions; the ring is an outline so the
        // active border never resizes the miniature inside. content-visibility
        // lets a long issue skip laying out the thumbnails scrolled out of view.
        style={{
          width: THUMB_W,
          height: Math.round((THUMB_W * PAGE_H) / PAGE_W),
        }}
        className={`bg-page relative block touch-none scroll-my-3 overflow-hidden rounded-[3px] text-left [content-visibility:auto] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${
          active
            ? "outline-accent shadow-[0_2px_6px_rgba(40,36,28,0.12)] outline-2"
            : "outline-hair-warm outline-1"
        }`}
      >
        {/* Decorative: the button's label already says which page it is, and
            inert keeps anything focusable in the page out of the tab order. */}
        <div aria-hidden inert>
          {thumb}
        </div>
        <span className="text-faint bg-page/90 absolute right-1 bottom-1 rounded-[2px] px-1 font-sans text-[9px] font-semibold">
          {index + 1}
        </span>
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          title={`Delete page ${index + 1}`}
          aria-label={`Delete page ${index + 1}`}
          className="bg-paper text-faint2 hover:text-warn hover:border-warn border-hair-warm absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']"
        >
          <Icon name="trash" size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
