"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type IssueContent } from "@/lib/blocks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import {
  enabledThemes,
  getTheme,
  normaliseEnabledThemeId,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { useEditorPages } from "./use-editor-pages";
import { EditorBlock } from "./editor-block";
import { reportEditorError } from "./report-error";
import { PageRail } from "./page-rail";
import { PublishModal } from "./publish-modal";
import { EditorHeader, type SaveStatus } from "./editor-header";
import { EditorToolbar } from "./editor-toolbar";
import {
  publishIssueAction,
  saveIssueAction,
  saveMetaAction,
} from "@/app/admin/actions";

export type EditorIssue = {
  id: string;
  number: number;
  title: string;
  theme: string;
  content: IssueContent;
  revision: number;
  status: string;
};

export function Editor({
  issue,
  images: initialImages,
  sponsors,
  subscriberCount,
}: {
  issue: EditorIssue;
  images: ImageMap;
  sponsors: SponsorListItem[];
  subscriberCount: number;
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
  // The page/block model + all its mutation handlers (issue #36 decomposition).
  const {
    pages,
    curPage,
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
  } = useEditorPages(issue.content);
  // imageId → resolved image, seeded from the server and grown as uploads land,
  // so the canvas previews an image the moment it's uploaded.
  const [images, setImages] = useState<ImageMap>(initialImages);
  const registerImage = (imageId: string, image: ResolvedImage) =>
    setImages((m) => ({ ...m, [imageId]: image }));
  const [title, setTitle] = useState(issue.title);
  // The issue's stored layout theme, normalised to an enabled theme id so the
  // picker (which offers only enabled themes) and the state stay in sync; an
  // unknown/disabled stored value degrades to the deployment default.
  const [themeId, setThemeId] = useState<LayoutThemeId>(
    normaliseEnabledThemeId(issue.theme),
  );
  const themes = enabledThemes();
  const [pub, setPub] = useState(false);
  // Once published (now or on load), the publish modal defaults email OFF so a
  // later correction can't re-blast the list.
  const [published, setPublished] = useState(issue.status === "published");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const router = useRouter();

  // Saves are serialized through one promise chain and carry the revision they
  // were based on, so an autosave can never overtake an earlier one and a stale
  // editor (another tab) gets a visible conflict instead of silently
  // overwriting newer work. Failures surface in the status pill with a retry.
  const statusRef = useRef(status);
  statusRef.current = status;
  const revisionRef = useRef(issue.revision);
  const latestRef = useRef({ pages, title, theme: themeId });
  latestRef.current = { pages, title, theme: themeId };
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
        reportEditorError(error, "save", { issueId: issue.id, kind });
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
  }, [title, themeId, issue.id]);

  // Warn before closing the tab while an edit hasn't landed on the server.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "saved") return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Fit-and-zoom the fixed PAGE_W×PAGE_H canvas to the editor stage (zoom=1),
  // exactly as the reader does — so the editor is a faithful, to-scale preview —
  // then let a wheel/drag zoom+pan ride on top. No scrollbars: content past the
  // page edge is reached by dragging. PageFrame's boundary marks the clip. Drag
  // starts only on blank areas so blocks stay selectable/editable/draggable
  // (dnd-kit owns their pointer events).
  const panZoom = useCanvasPanZoom({
    contentWidth: PAGE_W,
    contentHeight: PAGE_H,
    fitMargin: { x: 80, y: 80 },
    fitClamp: { min: 0.5, max: 1.4 },
    initialFitScale: 0.75,
    blockSelector: "[data-editor-block]",
  });

  // Reset zoom/pan to the fitted view when switching pages.
  useEffect(() => {
    panZoom.resetView();
    // resetView is recreated each render; page change is the trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPage]);

  // Deselect the current block and collapse any lingering text highlight.
  // Clicking blank canvas (or pressing Escape) should clear a text selection
  // like a normal document, but the canvas pan/zoom layer captures the pointer
  // on an outside press, which suppresses the browser's native
  // click-to-collapse — so blur the active editable and clear the selection
  // ourselves. Covers every in-place editor (Tiptap body text and the plain
  // contentEditable headings / cover text alike).
  const deselect = () => {
    setSel(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.isContentEditable) {
      active.blur();
    }
    window.getSelection()?.removeAllRanges();
  };
  const deselectRef = useRef(deselect);
  deselectRef.current = deselect;

  // Escape deselects the current block (click-off on the canvas does too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") deselectRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const theme = getTheme(themeId);

  return (
    <div className="bg-card relative flex min-h-screen flex-col">
      <EditorHeader
        title={title}
        onTitleChange={setTitle}
        issueNumber={issue.number}
        themes={themes}
        themeId={themeId}
        onSelectTheme={setThemeId}
        status={status}
        onRetrySave={() => void enqueueSave("all")}
        onReload={() => window.location.reload()}
        onPreview={async () => {
          // Open the preview in a new tab so the editor stays mounted with its
          // unsaved in-memory state — closing the tab returns you to the editor
          // exactly as you left it (no stale back-navigation render). The blank
          // tab is opened in the click gesture to dodge popup blockers, then
          // pointed at the reader once the save lands.
          const tab = window.open("", "_blank");
          const ok = await flushSave();
          if (!ok) {
            // The save didn't land (status pill shows why) — don't preview
            // stale content.
            tab?.close();
            return;
          }
          // Preview by internal id under /admin: drafts are never served from
          // the public /read route (published issues only).
          const url = `/admin/issues/${issue.id}/preview`;
          if (tab) tab.location.href = url;
          else router.push(url);
        }}
        onPublish={() => setPub(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <PageRail
          pages={pages}
          curPage={curPage}
          addMenu={addMenu}
          onSelectPage={selectPage}
          onReorder={reorderPages}
          onAddPage={addPage}
          onDeletePage={deletePage}
          onToggleAddMenu={() => setAddMenu((v) => !v)}
          onCloseAddMenu={() => setAddMenu(false)}
        />

        <div className="bg-canvas flex flex-1 flex-col overflow-hidden">
          <EditorToolbar
            onAddBlock={addBlock}
            onToggleCover={toggleCover}
            coverDisabled={curPage === 0}
            coverActive={Boolean(page?.cover)}
          />

          <div
            ref={panZoom.containerRef}
            onClick={() => {
              // A drag-pan ends in a click; don't let it deselect the block.
              if (panZoom.consumeClickSuppression()) return;
              deselect();
            }}
            onPointerDown={panZoom.onPointerDown}
            onPointerMove={panZoom.onPointerMove}
            onPointerUp={panZoom.onPointerUp}
            onPointerCancel={panZoom.onPointerUp}
            className={`flex flex-1 items-center justify-center overflow-hidden p-10 ${
              panZoom.panning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            <div
              className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]"
              style={{
                transform: `translate(${panZoom.pan.x}px, ${panZoom.pan.y}px)`,
              }}
            >
              <ScaledPage scale={panZoom.scale}>
                <PageFrame
                  theme={theme}
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
                            theme={theme}
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
          subscriberCount={subscriberCount}
          alreadyPublished={published}
          onClose={() => setPub(false)}
          onPublish={async (sendEmail) => {
            try {
              // Flush the latest edits first; publishing stale content would
              // ship the wrong issue. A failed flush surfaces in the status
              // pill and blocks the publish.
              const ok = await flushSave();
              if (!ok) return { ok: false };
              const res = await publishIssueAction(issue.id, sendEmail);
              if (res.ok) setPublished(true);
              else setStatus("error");
              return res;
            } catch (error) {
              reportEditorError(error, "publish", {
                issueId: issue.id,
                sendEmail,
              });
              setStatus("error");
              return { ok: false };
            }
          }}
        />
      )}
    </div>
  );
}
