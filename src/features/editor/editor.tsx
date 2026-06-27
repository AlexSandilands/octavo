"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import {
  makeBlock,
  makePage,
  PAGE_TEMPLATES,
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
import { PageFrame } from "@/features/blocks/page-frame";
import { EditorBlock } from "./editor-block";
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
  const initialPages =
    issue.content.pages.length > 0 ? issue.content.pages : [makePage()];

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

  // Size the editing page to the canvas exactly as the reader sizes one of its
  // pages: same aspect ratio, fixed dimensions, fixed text. The page is then a
  // faithful preview — content past its bottom edge stays visible for editing
  // but PageFrame's boundary marker shows where the reader will clip.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pageDim, setPageDim] = useState({ w: 427, h: 560 });
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const RATIO = 451 / 592; // ~15% wider than A-series; matches the reader
    const update = () => {
      const availH = el.clientHeight - 56;
      const availW = el.clientWidth - 56;
      const h = Math.max(460, Math.min(availH, availW / RATIO));
      setPageDim({ w: Math.round(h * RATIO), h: Math.round(h) });
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
  const deletePage = (index: number) => {
    if (pages.length <= 1) return;
    setPages((ps) => ps.filter((_, i) => i !== index));
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
          <Link
            href={`/read/${issue.number}`}
            className="border-hair text-ink flex h-10 items-center rounded-lg border-[1.5px] bg-white px-4 font-sans text-sm font-semibold"
          >
            Preview
          </Link>
          <button
            onClick={() => setPub(true)}
            className="bg-accent text-paper flex h-10 items-center rounded-lg px-5 font-sans text-sm font-semibold shadow-[0_2px_8px_rgba(29,77,62,0.25)]"
          >
            Publish
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="bg-paper border-line flex w-[150px] flex-none flex-col items-center gap-3 border-r py-4">
          <span className="text-faint w-full pl-[18px] font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">
            Pages
          </span>
          {pages.map((p, i) => (
            <div key={p.id} className="group relative">
              <button
                onClick={() => {
                  setCurPage(i);
                  setSel(null);
                }}
                className={`bg-page relative block h-[108px] w-[84px] rounded-[3px] p-2.5 text-left ${
                  i === curPage
                    ? "border-accent border-2 shadow-[0_2px_6px_rgba(40,36,28,0.12)]"
                    : "border border-[#e0d9c9]"
                }`}
              >
                <div className="h-2 w-[80%] rounded-[2px] bg-[#e0d9c9]" />
                <div className="mt-1.5 h-1 w-[90%] rounded-[2px] bg-[#ece6da]" />
                <span className="text-faint absolute right-2 bottom-1.5 font-sans text-[9px] font-semibold">
                  {i + 1}
                </span>
              </button>
              {pages.length > 1 && (
                <button
                  onClick={() => deletePage(i)}
                  title={`Delete page ${i + 1}`}
                  aria-label={`Delete page ${i + 1}`}
                  className="bg-paper text-faint2 hover:text-warn hover:border-warn absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#e0d9c9] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Icon name="trash" size={13} strokeWidth={1.8} />
                </button>
              )}
            </div>
          ))}
          <div className="relative">
            <button
              onClick={() => setAddMenu((v) => !v)}
              aria-expanded={addMenu}
              className="text-faint hover:border-accent hover:text-accent flex h-10 w-[84px] items-center justify-center gap-1.5 rounded-[3px] border-[1.5px] border-dashed border-[#c9c1b1] font-sans text-[11px] font-semibold"
            >
              <Icon name="plus" size={14} strokeWidth={1.8} />
              Add
            </button>
            {addMenu && (
              <>
                {/* Click-off backdrop */}
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setAddMenu(false)}
                />
                <div className="bg-card absolute top-0 left-[92px] z-30 w-56 overflow-hidden rounded-lg border border-[#e0d9c9] shadow-[0_12px_32px_rgba(40,36,28,0.18)]">
                  {PAGE_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addPage(t.id)}
                      className="block w-full px-3.5 py-2.5 text-left hover:bg-[#f4f8f5]"
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
          </div>

          <div
            ref={canvasRef}
            onClick={() => setSel(null)}
            className="flex flex-1 items-start justify-center overflow-auto p-7"
          >
            <div className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]">
              <PageFrame
                theme={themeName}
                w={pageDim.w}
                h={pageDim.h}
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
                    <div className="relative flow-root">
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
            </div>
          </div>
        </div>
      </div>

      {pub && (
        <PublishModal
          number={issue.number}
          onClose={() => setPub(false)}
          onConfirm={async () => {
            await publishIssueAction(issue.id);
            setPub(false);
          }}
        />
      )}
    </div>
  );
}

function PublishModal({
  number,
  onClose,
  onConfirm,
}: {
  number: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card w-[480px] overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="px-8 pt-7">
          <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Publish &amp; send
          </div>
          <h2 className="text-ink mt-3 font-serif text-[27px] leading-tight">
            Publish issue No. {number}?
          </h2>
          <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
            This marks the issue published so members can read it. (Email blasts
            arrive in a later phase.)
          </p>
        </div>
        <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
          <button
            onClick={onClose}
            className="border-hair text-ink flex h-12 items-center rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold"
          >
            Keep as draft
          </button>
          <button
            onClick={onConfirm}
            className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)]"
          >
            <Icon name="check" size={18} strokeWidth={1.8} />
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
