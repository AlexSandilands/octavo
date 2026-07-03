"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
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
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
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

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;

export type EditorIssue = {
  id: string;
  number: number;
  title: string;
  theme: string;
  content: IssueContent;
  revision: number;
};

type SaveStatus = "saved" | "saving" | "error" | "conflict";

export function Editor({
  issue,
  images: initialImages,
  sponsors,
}: {
  issue: EditorIssue;
  images: ImageMap;
  sponsors: SponsorListItem[];
}) {
  // The picker chooses from this list; the canvas previews a placed sponsor
  // through the map derived from it (same shape the readers resolve server-side).
  const sponsorMap: SponsorMap = useMemo(
    () =>
      Object.fromEntries(
        sponsors.map((s) => [
          s.id,
          { name: s.name, href: s.href, logo: s.logo },
        ]),
      ),
    [sponsors],
  );
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
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [addMenu, setAddMenu] = useState(false);
  const router = useRouter();

  // Saves are serialized through one promise chain and carry the revision they
  // were based on, so an autosave can never overtake an earlier one and a stale
  // editor (another tab) gets a visible conflict instead of silently
  // overwriting newer work. Failures surface in the status pill with a retry.
  const statusRef = useRef(status);
  statusRef.current = status;
  const revisionRef = useRef(issue.revision);
  const latestRef = useRef({ pages, title, theme });
  latestRef.current = { pages, title, theme };
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const enqueueSave = (kind: "content" | "meta" | "all") => {
    const run = async (): Promise<boolean> => {
      // After a conflict only a reload makes sense — don't keep writing.
      if (statusRef.current === "conflict") return false;
      setStatus("saving");
      try {
        const { pages, title, theme } = latestRef.current;
        if (kind !== "meta") {
          const res = await saveIssueAction(
            issue.id,
            { pages },
            revisionRef.current,
          );
          if (!res.ok) {
            setStatus(res.reason === "conflict" ? "conflict" : "error");
            return false;
          }
          revisionRef.current = res.revision;
        }
        if (kind !== "content") {
          const res = await saveMetaAction(issue.id, { title, theme });
          if (!res.ok) {
            setStatus("error");
            return false;
          }
        }
        setStatus("saved");
        return true;
      } catch (error) {
        console.error(`Saving issue ${issue.id} failed (${kind})`, error);
        setStatus("error");
        return false;
      }
    };
    const next = chainRef.current.then(run, run);
    chainRef.current = next;
    return next;
  };

  // Flush the latest content + meta to the server *now*, bypassing the debounce.
  // Navigating to Preview (or publishing) before the 800ms autosave fires would
  // otherwise drop the most recent edits — they'd reload stale from the DB.
  // Returns false when the save didn't land, so callers don't proceed.
  const flushSave = () => enqueueSave("all");

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
    if (statusRef.current !== "conflict") setStatus("saving");
    const t = setTimeout(() => void enqueueSave("content"), 800);
    return () => clearTimeout(t);
    // enqueueSave reads latest state through refs; the deps that matter are the
    // edits themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, issue.id]);

  // Debounced autosave of meta (title + theme).
  const firstMeta = useRef(true);
  useEffect(() => {
    if (firstMeta.current) {
      firstMeta.current = false;
      return;
    }
    if (statusRef.current !== "conflict") setStatus("saving");
    const t = setTimeout(() => void enqueueSave("meta"), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, theme, issue.id]);

  // Warn before closing the tab while an edit hasn't landed on the server.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "saved") return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Scale the fixed PAGE_W×PAGE_H canvas to fit the editor stage (zoom=1), exactly
  // as the reader does — so the editor is a faithful, to-scale preview — then let
  // a wheel/drag zoom+pan ride on top. No scrollbars: content past the page edge
  // is reached by dragging the canvas. PageFrame's boundary marks the clip.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.75);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const availH = el.clientHeight - 80;
      const availW = el.clientWidth - 80;
      const s = Math.min(availH / PAGE_H, availW / PAGE_W);
      setFitScale(Math.max(0.5, Math.min(1.4, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale * zoom;

  // Drag to move the canvas, wheel to zoom at the cursor — same model as the
  // reader. Latest values are mirrored into refs for the native (non-passive)
  // wheel handler, which can't close over fresh state.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const fitScaleRef = useRef(fitScale);
  zoomRef.current = zoom;
  panRef.current = pan;
  fitScaleRef.current = fitScale;
  // Set on a moved drag so the click that follows a pan doesn't deselect.
  const suppressClick = useRef(false);

  // Keep at least a sliver of the page on screen so it can't be lost.
  const clampPan = (p: { x: number; y: number }, zoomVal: number) => {
    const el = canvasRef.current;
    if (!el) return p;
    const sc = fitScaleRef.current * zoomVal;
    const keep = 90;
    const maxX = Math.max(0, (PAGE_W * sc + el.clientWidth) / 2 - keep);
    const maxY = Math.max(0, (PAGE_H * sc + el.clientHeight) / 2 - keep);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  };

  // Zoom to `next`, holding a focal point (offset from the canvas centre) fixed.
  const applyZoom = (nextRaw: number, focalX = 0, focalY = 0) => {
    const prev = zoomRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextRaw));
    if (next === prev) return;
    const f = next / prev;
    const p = panRef.current;
    setZoom(next);
    setPan(
      clampPan(
        { x: f * p.x + (1 - f) * focalX, y: f * p.y + (1 - f) * focalY },
        next,
      ),
    );
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left - rect.width / 2;
      const focalY = e.clientY - rect.top - rect.height / 2;
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0015), focalX, focalY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // applyZoom reads refs, so it never goes stale; bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-drag to move the canvas, started only on blank areas so blocks stay
  // selectable, editable and draggable (dnd-kit owns their pointer events).
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  const onPanDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    if ((e.target as HTMLElement).closest("[data-editor-block]")) return;
    const el = canvasRef.current;
    if (!el) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPanMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3)
      d.moved = true;
    setPan(
      clampPan(
        { x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) },
        zoom,
      ),
    );
  };
  const onPanUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.moved) suppressClick.current = true;
    drag.current = null;
    setPanning(false);
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };

  // Reset zoom/pan to the fitted view when switching pages.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [curPage]);

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
          {status === "error" ? (
            <span className="flex items-center gap-2 font-sans text-[12px]">
              <span className="text-warn font-semibold">Couldn’t save</span>
              <button
                onClick={() => void enqueueSave("all")}
                className="border-warn text-warn rounded-md border px-2 py-0.5 font-semibold hover:bg-warn-soft"
              >
                Retry
              </button>
            </span>
          ) : status === "conflict" ? (
            <span className="flex items-center gap-2 font-sans text-[12px]">
              <span className="text-warn font-semibold">
                Changed somewhere else
              </span>
              <button
                onClick={() => window.location.reload()}
                className="border-warn text-warn rounded-md border px-2 py-0.5 font-semibold hover:bg-warn-soft"
              >
                Reload
              </button>
            </span>
          ) : (
            <span className="text-faint2 font-sans text-[11px]">
              {status === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
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
              const ok = await flushSave();
              if (!ok) {
                // The save didn't land (status pill shows why) — don't preview
                // stale content.
                tab?.close();
                return;
              }
              // Preview by internal id under /admin: drafts are never served
              // from the public /read route (published issues only).
              const url = `/admin/issues/${issue.id}/preview`;
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
            onClick={() => {
              // A drag-pan ends in a click; don't let it deselect the block.
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setSel(null);
            }}
            onPointerDown={onPanDown}
            onPointerMove={onPanMove}
            onPointerUp={onPanUp}
            onPointerCancel={onPanUp}
            className={`flex flex-1 items-center justify-center overflow-hidden p-10 ${
              panning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            <div
              className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
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
                            sponsors={sponsors}
                            sponsorMap={sponsorMap}
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
            try {
              const ok = await flushSave();
              if (ok) {
                const res = await publishIssueAction(issue.id);
                if (!res.ok) setStatus("error");
              }
            } catch (error) {
              console.error(`Publishing issue ${issue.id} failed`, error);
              setStatus("error");
            }
            setPub(false);
          }}
        />
      )}
    </div>
  );
}
