import { useState } from "react";
import {
  ensureCoverFirst,
  makeBlock,
  makePage,
  mergeBlock,
  type BlockPatch,
  type BlockType,
  type IssueContent,
  type Page,
  type PageTemplate,
} from "@/lib/blocks";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";

// The editor's page/block model + all the operations that mutate it — extracted
// from editor.tsx (issue #36) so the component stays under the size limit and
// the page/block ops read as one cohesive unit. Owns the pages, the current-page
// index, the selected-block id and the add-page menu; the editor wires the
// returned handlers to the header, rail, toolbar and canvas, and reads `pages`
// for autosave. The cover-first invariant is enforced on every structural edit.
export function useEditorPages(content: IssueContent) {
  const initialPages = ensureCoverFirst(
    content.pages.length > 0 ? content.pages : [makePage("cover-classic")],
  );

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [curPage, setCurPage] = useState(0);
  const [sel, setSel] = useState<string | null>(
    initialPages[0]?.blocks[0]?.id ?? null,
  );
  const [addMenu, setAddMenu] = useState(false);

  const page = pages[curPage] ?? pages[0];

  const editPage = (fn: (p: Page) => Page) =>
    setPages((ps) => ps.map((p, i) => (i === curPage ? fn(p) : p)));

  // Switch to a page and drop the selection (the block picked on the old page
  // isn't on the new one).
  const selectPage = (i: number) => {
    setCurPage(i);
    setSel(null);
  };

  // The first page is always the cover, so it can't be toggled off.
  const toggleCover = () => {
    if (curPage === 0) return;
    editPage((p) => ({ ...p, cover: !p.cover }));
  };

  const addBlock = (type: BlockType) => {
    const blk = makeBlock(type);
    editPage((p) => ({ ...p, blocks: [...p.blocks, blk] }));
    setSel(blk.id);
  };

  const updateBlock = (id: string, patch: BlockPatch) =>
    editPage((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? mergeBlock(b, patch) : b)),
    }));

  const moveBlock = (id: string, dir: -1 | 1) =>
    editPage((p) => {
      const arr = [...p.blocks];
      const i = arr.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return p;
      const a = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = a;
      return { ...p, blocks: arr };
    });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    editPage((p) => {
      const from = p.blocks.findIndex((b) => b.id === active.id);
      const to = p.blocks.findIndex((b) => b.id === over.id);
      if (from < 0 || to < 0) return p;
      return { ...p, blocks: arrayMove(p.blocks, from, to) };
    });
  };

  const removeBlock = (id: string) => {
    editPage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    if (sel === id) setSel(null);
  };

  const addPage = (template: PageTemplate = "blank") => {
    setPages((ps) => [...ps, makePage(template)]);
    setCurPage(pages.length);
    setSel(null);
    setAddMenu(false);
  };

  // Reorder pages from the rail, keeping the page you're editing selected as the
  // list shuffles (curPage is an index, so it has to follow the moved page).
  const reorderPages = (from: number, to: number) => {
    const activeId = pages[curPage]?.id;
    // The front-cover flag follows position 1: whatever lands there becomes
    // the cover, and the page displaced from it is demoted — so a reorder can
    // never leave two flagged pages. Extra cover-styled pages elsewhere stay
    // possible only via the explicit "Cover page" toggle.
    const prevFirstId = pages[0]?.id;
    const next = ensureCoverFirst(
      arrayMove(pages, from, to).map((p, i) =>
        i !== 0 && p.id === prevFirstId ? { ...p, cover: false } : p,
      ),
    );
    setPages(next);
    const newCur = next.findIndex((p) => p.id === activeId);
    if (newCur >= 0) setCurPage(newCur);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) return;
    setPages((ps) => ensureCoverFirst(ps.filter((_, i) => i !== index)));
    // Keep the current page valid as the list shrinks: shift selection left if
    // we removed the active page or one before it.
    setCurPage((c) => Math.min(c > index ? c - 1 : c, pages.length - 2));
    setSel(null);
  };

  return {
    pages,
    curPage,
    setCurPage,
    sel,
    setSel,
    addMenu,
    setAddMenu,
    page,
    selectPage,
    toggleCover,
    addBlock,
    updateBlock,
    moveBlock,
    onDragEnd,
    removeBlock,
    addPage,
    reorderPages,
    deletePage,
  };
}
