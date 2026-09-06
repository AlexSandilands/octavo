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
  type PageAlign,
  type PageTemplate,
} from "@/lib/blocks";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { flowTextBlock, moveBlockToNextPage } from "./text-flow";
import {
  changedBlockIds,
  useEditorHistory,
  useUndoShortcuts,
  type EditorSnapshot,
} from "./use-editor-history";

// The editor's page/block model + all the operations that mutate it — extracted
// from editor.tsx (issue #36) so the component stays under the size limit and
// the page/block ops read as one cohesive unit. Owns the pages, the current-page
// index, the selected-block id and the add-page menu; the editor wires the
// returned handlers to the header, rail, toolbar and canvas, and reads `pages`
// for autosave. The cover-first invariant is enforced on every structural edit.
//
// Every operation takes an undo step first (issue #222) — `commit()`, or
// `commit("<stream>")` for one that repeats under the author's hand and should
// undo as a run. A no-op resolves before it commits, so no step is ever empty.
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
  // A text block's Tiptap editor is uncontrolled once seeded, so a change we
  // make to its body behind its back (the flow split, an undo) has to remount
  // it. Bumping the block's counter here changes its React key — see the canvas
  // in editor.tsx.
  const [reseed, setReseed] = useState<Record<string, number>>({});

  const page = pages[curPage] ?? pages[0];

  const history = useEditorHistory();
  // Snapshots this render's state, so two operations in one event would push the
  // same pre-state twice — every op here is its own user event.
  const commit = (stream?: string) =>
    history.record({ pages, curPage, sel }, stream);

  const restore = (next: EditorSnapshot | null) => {
    if (!next) return;
    const stale = changedBlockIds(pages, next.pages);
    setPages(next.pages);
    setCurPage(Math.min(next.curPage, next.pages.length - 1));
    setSel(next.sel);
    if (stale.length > 0) {
      setReseed((r) => {
        const out = { ...r };
        for (const id of stale) out[id] = (out[id] ?? 0) + 1;
        return out;
      });
    }
  };

  const undo = () => restore(history.undo({ pages, curPage, sel }));
  const redo = () => restore(history.redo({ pages, curPage, sel }));
  useUndoShortcuts({ undo, redo });

  const editPage = (fn: (p: Page) => Page) =>
    setPages((ps) => ps.map((p, i) => (i === curPage ? fn(p) : p)));

  // Switch to a page and drop the selection (the block picked on the old page
  // isn't on the new one). Not an undo step: it edits nothing.
  const selectPage = (i: number) => {
    setCurPage(i);
    setSel(null);
  };

  // The first page is always the cover, so it can't be toggled off.
  const toggleCover = () => {
    if (curPage === 0) return;
    commit();
    editPage((p) => ({ ...p, cover: !p.cover }));
  };

  const addBlock = (type: BlockType) => {
    // A filled page belongs to its photo; the tool bar disables the insert
    // buttons, and this is the guard behind them.
    if (pageFillsCanvas(page)) return;
    const blk = makeBlock(type);
    commit();
    editPage((p) => ({ ...p, blocks: [...p.blocks, blk] }));
    setSel(blk.id);
  };

  const updateBlock = (id: string, patch: BlockPatch) => {
    // One stream per block *and* field, so a typing run, a size nudge and a
    // width drag each fold into their own step rather than into each other.
    commit(`${id}:${Object.keys(patch).sort().join(",")}`);
    editPage((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? mergeBlock(b, patch) : b)),
    }));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const blocks = pages[curPage]?.blocks;
    const i = blocks?.findIndex((b) => b.id === id) ?? -1;
    const j = i + dir;
    if (i < 0 || j < 0 || j >= (blocks?.length ?? 0)) return;
    commit();
    editPage((p) => {
      const arr = [...p.blocks];
      const a = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = a;
      return { ...p, blocks: arr };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const blocks = pages[curPage]?.blocks;
    const from = blocks?.findIndex((b) => b.id === active.id) ?? -1;
    const to = blocks?.findIndex((b) => b.id === over.id) ?? -1;
    if (from < 0 || to < 0) return;
    commit();
    editPage((p) => ({ ...p, blocks: arrayMove(p.blocks, from, to) }));
  };

  const removeBlock = (id: string) => {
    commit();
    editPage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    if (sel === id) setSel(null);
  };

  // Split an overflowing text block at the cut points the canvas measurement
  // worked out (issue #93): it keeps what fits this page, and the rest becomes
  // continuation blocks on the pages that follow, created as needed. One state
  // value out, so the shrink, the new blocks and the new pages autosave together
  // as a single document — a half-applied split can never reach the DB.
  const flowText = (id: string, cuts: number[]) => {
    const next = flowTextBlock(pages, curPage, id, cuts);
    if (!next) return;
    commit();
    setPages(next);
    setReseed((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
  };

  // The same fix for a block there is no way to cut — an image, a heading, a
  // sponsor panel: the whole thing moves to the following page.
  const moveToNextPage = (id: string) => {
    const next = moveBlockToNextPage(pages, curPage, id);
    if (!next) return;
    commit();
    setPages(next);
    // The block is no longer on the page being edited, so nothing is selected.
    if (sel === id) setSel(null);
  };

  // "Fill page" / "Fit page" (issue #227): a page-owning photo owns its page, so
  // one that shares a page moves onto a page of its own on the way — the
  // placement and the move land together as one document, and undo as one step.
  // Switching between the two while already alone is just the field write.
  const fillPage = (id: string, align: PageAlign) => {
    const source = pages[curPage];
    const block = source?.blocks.find((b) => b.id === id);
    if (!source || source.cover || block?.type !== "image") return;
    // Already this placement and already alone: no work, and no empty undo step.
    if (block.align === align && source.blocks.length === 1) return;
    const filled = pages.map((p, i) =>
      i === curPage
        ? {
            ...p,
            blocks: p.blocks.map((b) =>
              b.id === id ? mergeBlock(b, { align }) : b,
            ),
          }
        : p,
    );
    if (source.blocks.length === 1) {
      commit();
      setPages(filled);
      return;
    }
    // No room for the page it needs: leave the document exactly as it was
    // rather than bleed a photo over content that has nowhere to go.
    const moved = moveBlockToNextPage(filled, curPage, id);
    if (!moved) return;
    commit();
    setPages(moved);
    setCurPage(curPage + 1);
    setSel(id);
  };

  const addPage = (template: PageTemplate = "blank") => {
    commit();
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
    commit();
    setPages(next);
    const newCur = next.findIndex((p) => p.id === activeId);
    if (newCur >= 0) setCurPage(newCur);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) return;
    commit();
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
    reseed,
    page,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    historyNotice: history.notice,
    undo,
    redo,
    selectPage,
    toggleCover,
    addBlock,
    updateBlock,
    moveBlock,
    onDragEnd,
    removeBlock,
    flowText,
    moveToNextPage,
    fillPage,
    addPage,
    reorderPages,
    deletePage,
  };
}
