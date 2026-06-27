"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import {
  ensureCoverFirst,
  makeBlock,
  makePage,
  type Block,
  type BlockType,
  type IssueContent,
  type Page,
  type PageTemplate,
} from "@/lib/blocks";
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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { type Theme } from "@/features/blocks/block-view";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import { EditorBlock } from "./editor-block";
import { PageRail } from "./page-rail";
import { PublishModal } from "./publish-modal";
import {
  publishIssueAction,
  saveIssueAction,
  saveMetaAction,
} from "@/app/admin/actions";

const INSERT: { type: BlockType; label: string; icon: IconName }[] = [
  { type: "heading", label: "Heading", icon: "heading" },
  { type: "text", label: "Text", icon: "menu" },
  { type: "image", label: "Image", icon: "image" },
  { type: "sponsor", label: "Sponsor", icon: "banner" },
];

export type EditorIssue = {
  id: string;
  number: number;
  title: string;
  theme: string;
  content: IssueContent;
};

export function Editor({
  issue,
  images: initialImages,
}: {
  issue: EditorIssue;
  images: ImageMap;
}) {
  const initialPages = ensureCoverFirst(
    issue.content.pages.length > 0
      ? issue.content.pages
      : [makePage("cover-classic")],
  );

  const [pages, setPages] = useState<Page[]>(initialPages);
  // imageId → resolved image, seeded from the server and grown as uploads land,
  // so the canvas previews an image the moment it's uploaded.
  const [images, setImages] = useState<ImageMap>(initialImages);
  const registerImage = (imageId: string, image: ResolvedImage) =>
    setImages((m) => ({ ...m, [imageId]: image }));
  const [title, setTitle] = useState(issue.title);
  const [theme, setTheme] = useState(
    issue.theme === "modern" ? "modern" : "classic",
  );
  const [curPage, setCurPage] = useState(0);
  const [sel, setSel] = useState<string | null>(
    initialPages[0]?.blocks[0]?.id ?? null,
  );
  const [pub, setPub] = useState(false);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [addMenu, setAddMenu] = useState(false);
  const router = useRouter();

  // Flush the latest content + meta to the server *now*, bypassing the debounce.
  // Navigating to Preview (or publishing) before the 800ms autosave fires would
  // otherwise drop the most recent edits — they'd reload stale from the DB.
  const flushSave = async () => {
    setStatus("saving");
    await Promise.all([
      saveIssueAction(issue.id, { pages }),
      saveMetaAction(issue.id, { title, theme }),
    ]);
    setStatus("saved");
  };

  // Drag from the handle, or move with the keyboard once the handle is focused.
  // A small distance threshold lets a plain click on the handle still select.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Debounced autosave of content.
  const firstContent = useRef(true);
  useEffect(() => {
    if (firstContent.current) {
      firstContent.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      await saveIssueAction(issue.id, { pages });
      setStatus("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [pages, issue.id]);

  // Debounced autosave of meta (title + theme).
  const firstMeta = useRef(true);
  useEffect(() => {
    if (firstMeta.current) {
      firstMeta.current = false;
      return;
    }
    const t = setTimeout(() => saveMetaAction(issue.id, { title, theme }), 800);
    return () => clearTimeout(t);
  }, [title, theme, issue.id]);

  // Scale the fixed PAGE_W×PAGE_H canvas to fit the editor stage, exactly as the
  // reader does — so the editor is a faithful, to-scale preview. Content past the
  // bottom edge stays visible for editing; PageFrame's boundary marks the clip.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const availH = el.clientHeight - 56;
      const availW = el.clientWidth - 56;
      const s = Math.min(availH / PAGE_H, availW / PAGE_W);
      setScale(Math.max(0.5, Math.min(1.4, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape deselects the current block (click-off on the canvas does too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const themeName: Theme = theme === "modern" ? "Modern" : "Classic";
  const page = pages[curPage] ?? pages[0];

  const editPage = (fn: (p: Page) => Page) =>
    setPages((ps) => ps.map((p, i) => (i === curPage ? fn(p) : p)));

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
  const updateBlock = (id: string, patch: Record<string, string | number>) =>
    editPage((p) => ({
      ...p,
      blocks: p.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as Block) : b,
      ),
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
    // ensureCoverFirst: whatever lands in position 1 becomes the cover.
    const next = ensureCoverFirst(arrayMove(pages, from, to));
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

  return (
    <div className="bg-card relative flex min-h-screen flex-col">
      <header className="border-line flex h-[60px] flex-none items-center justify-between border-b px-6">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin"
            className="text-muted"
            aria-label="Back to issues"
          >
            <Icon name="chevronLeft" size={20} />
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-ink min-w-0 border-none bg-transparent font-serif text-[21px] outline-none"
            placeholder="Untitled issue"
          />
          <span className="flex items-center gap-1.5 rounded-full bg-[#efeae0] px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b8b1a2]" />
            <span className="text-faint font-sans text-[11px] font-semibold">
              Draft · No. {issue.number}
            </span>
          </span>
          <span className="text-faint2 font-sans text-[11px]">
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setTheme((t) => (t === "classic" ? "modern" : "classic"))
            }
            className="border-hair text-ink hover:border-accent flex h-10 items-center gap-2 rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-sm font-medium capitalize"
          >
            Theme: {theme}
            <Icon name="chevronDown" size={14} strokeWidth={1.8} />
          </button>
          <button
            onClick={async () => {
              // Open the preview in a new tab so the editor stays mounted with
              // its unsaved in-memory state — closing the tab returns you to the
              // editor exactly as you left it (no stale back-navigation render).
              // The blank tab is opened in the click gesture to dodge popup
              // blockers, then pointed at the reader once the save lands.
              const tab = window.open("", "_blank");
              await flushSave();
              const url = `/read/${issue.number}`;
              if (tab) tab.location.href = url;
              else router.push(url);
            }}
            className="border-hair text-ink flex h-10 items-center rounded-lg border-[1.5px] bg-white px-4 font-sans text-sm font-semibold"
          >
            Preview
          </button>
          <button
            onClick={() => setPub(true)}
            className="bg-accent text-paper flex h-10 items-center rounded-lg px-5 font-sans text-sm font-semibold shadow-[0_2px_8px_rgba(29,77,62,0.25)]"
          >
            Publish
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <PageRail
          pages={pages}
          curPage={curPage}
          addMenu={addMenu}
          onSelectPage={(i) => {
            setCurPage(i);
            setSel(null);
          }}
          onReorder={reorderPages}
          onAddPage={addPage}
          onDeletePage={deletePage}
          onToggleAddMenu={() => setAddMenu((v) => !v)}
          onCloseAddMenu={() => setAddMenu(false)}
        />

        <div className="flex flex-1 flex-col overflow-hidden bg-[#ece7dc]">
          <div className="bg-paper border-line flex h-[52px] flex-none items-center gap-2.5 border-b px-5">
            <span className="text-faint mr-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">
              Insert
            </span>
            {INSERT.map((b) => (
              <button
                key={b.type}
                onClick={() => addBlock(b.type)}
                className="text-ink hover:border-accent flex h-[34px] items-center gap-1.5 rounded-[7px] border border-[#e0d9c9] bg-white px-3.5 font-sans text-[13px] font-semibold hover:bg-[#f4f8f5]"
              >
                <Icon name={b.icon} size={15} className="text-accent" />
                {b.label}
              </button>
            ))}
            <div className="ml-auto flex items-center">
              <button
                onClick={toggleCover}
                disabled={curPage === 0}
                aria-pressed={Boolean(page?.cover)}
                title={
                  curPage === 0
                    ? "The first page is always the cover"
                    : "Lay this page out as a cover"
                }
                className={`flex h-[34px] items-center gap-1.5 rounded-[7px] border px-3.5 font-sans text-[13px] font-semibold ${
                  page?.cover
                    ? "border-accent bg-accent text-paper"
                    : "text-ink border-[#e0d9c9] bg-white hover:border-accent hover:bg-[#f4f8f5]"
                } ${curPage === 0 ? "cursor-default opacity-90" : ""}`}
              >
                <Icon name="doc" size={15} />
                Cover page
              </button>
            </div>
          </div>

          <div
            ref={canvasRef}
            onClick={() => setSel(null)}
            className="flex flex-1 items-start justify-center overflow-auto p-7"
          >
            <div className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]">
              <ScaledPage scale={scale}>
                <PageFrame
                  theme={themeName}
                  w={PAGE_W}
                  h={PAGE_H}
                  issueNo={issue.number}
                  pageNo={curPage + 1}
                  clip={false}
                  boundary
                >
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={(page?.blocks ?? []).map((b) => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div
                        className={
                          page?.cover
                            ? "flex min-h-full flex-col justify-center"
                            : "relative flow-root"
                        }
                      >
                        {page && page.blocks.length === 0 && (
                          <div className="text-faint2 py-16 text-center font-serif text-sm">
                            This page is empty. Add a block above.
                          </div>
                        )}
                        {page?.blocks.map((b) => (
                          <EditorBlock
                            key={b.id}
                            block={b}
                            theme={themeName}
                            cover={page.cover}
                            selected={b.id === sel}
                            issueId={issue.id}
                            images={images}
                            onSelect={() => setSel(b.id)}
                            onChange={(patch) => updateBlock(b.id, patch)}
                            onMove={(dir) => moveBlock(b.id, dir)}
                            onRemove={() => removeBlock(b.id)}
                            onRegisterImage={registerImage}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </PageFrame>
              </ScaledPage>
            </div>
          </div>
        </div>
      </div>

      {pub && (
        <PublishModal
          number={issue.number}
          onClose={() => setPub(false)}
          onConfirm={async () => {
            await flushSave();
            await publishIssueAction(issue.id);
            setPub(false);
          }}
        />
      )}
    </div>
  );
}
