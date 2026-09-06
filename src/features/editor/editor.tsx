"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
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
import { footerHeldBack } from "@/lib/branding";
import type { FooterReserve, FooterStyle, SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { LogoListItem } from "@/lib/logos";
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
import { pageFillsCanvas } from "@/features/blocks/layout";
import { useCanvasPanZoom } from "@/features/blocks/use-canvas-pan-zoom";
import { useEditorPages } from "./use-editor-pages";
import { useTextFlow } from "./use-text-flow";
import { EditorBlock } from "./editor-block";
import { reportEditorError } from "./report-error";
import { PageRail } from "./page-rail";
import { PublishModal } from "./publish-modal";
import { EditorHeader } from "./editor-header";
import { EditorToolbar, TOOLBAR_RESERVE } from "./editor-toolbar";
import { FooterUpdateNotice } from "./footer-update-notice";
import { useEditorAutosave } from "./use-editor-autosave";
import { publishIssueAction } from "@/app/admin/actions";

// Extends FooterReserve: the footer this issue's pages were laid out against
// (issue #128) is what the canvas draws and measures overflow against, whatever
// the magazine setting has since become.
export type EditorIssue = FooterReserve & {
  id: string;
  number: number;
  title: string;
  theme: string;
  logoId: string | null;
  content: IssueContent;
  revision: number;
  status: string;
};

export function Editor({
  issue,
  images: initialImages,
  sponsors,
  logos,
  settings,
  magazineFooter,
  subscriberCount,
}: {
  issue: EditorIssue;
  images: ImageMap;
  sponsors: SponsorListItem[];
  logos: LogoListItem[];
  /** The magazine's effective branding + footer appearance (issue #105), with
   *  the footer already held to this issue's reserve (issue #128), so the editor
   *  canvas draws — and measures against — the page chrome the reader will get. */
  settings: SiteSettings;
  /** The magazine's footer as actually set, before that clamp. Only used to ask
   *  whether this issue is holding a taller footer back. */
  magazineFooter: FooterStyle;
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
    reseed,
    page,
    canUndo,
    canRedo,
    historyNotice,
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
  } = useEditorPages(issue.content);
  // Overflow marking + its one-action fix (issue #93): the canvas is measured
  // where it is laid out, and the split — or, for a block that can't be cut, the
  // move — lands as one edit.
  const { canvasRef, overflow, flow } = useTextFlow({
    page,
    onFlow: flowText,
    onMove: moveToNextPage,
  });
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
  // The issue's footer mark. The picker chooses from the library list; the
  // canvas previews the choice by resolving it through that same list, so the
  // page footer updates the moment it changes — no reload, no second query.
  const [logoId, setLogoId] = useState<string | null>(issue.logoId);
  const logo = logos.find((l) => l.id === logoId)?.image ?? null;
  const [pub, setPub] = useState(false);
  // Once published (now or on load), the publish modal defaults email OFF so a
  // later correction can't re-blast the list.
  const [published, setPublished] = useState(issue.status === "published");
  const router = useRouter();

  const { status, setStatus, enqueueSave, flushSave } = useEditorAutosave({
    issueId: issue.id,
    revision: issue.revision,
    pages,
    title,
    theme: themeId,
    logoId,
  });

  // Drag from the handle, or move with the keyboard once the handle is focused.
  // A small distance threshold lets a plain click on the handle still select.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Fit-and-zoom the fixed PAGE_W×PAGE_H canvas to the editor stage (zoom=1),
  // exactly as the reader does — so the editor is a faithful, to-scale preview —
  // then let a wheel/drag zoom+pan ride on top. No scrollbars: content past the
  // page edge is reached by dragging, and the overflow marker shows where the
  // page ran out. Drag starts only on blank areas so blocks stay
  // selectable/editable/draggable (dnd-kit owns their pointer events).
  // Destructured: property access on the returned object would read through
  // the ref it carries, which the render can't do.
  const {
    containerRef: stageRef,
    panRef,
    scale,
    panning,
    resetView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeClickSuppression,
  } = useCanvasPanZoom({
    contentWidth: PAGE_W,
    contentHeight: PAGE_H,
    // The stage's own padding: 40px above the page, the tool bar's reserve below.
    fitMargin: { x: 80, y: 40 + TOOLBAR_RESERVE },
    fitClamp: { min: 0.5, max: 1.4 },
    initialFitScale: 0.75,
    blockSelector: "[data-editor-block]",
  });

  // Reset zoom/pan to the fitted view when switching pages.
  useEffect(() => {
    resetView();
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
  // An effect event so the once-bound listener calls the latest closure.
  const deselectByKey = useEffectEvent(() => deselect());

  // Escape deselects the current block (click-off on the canvas does too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") deselectByKey();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const theme = getTheme(themeId);
  // This page is owned by a full-bleed photo (issue #227): no page furniture,
  // and nothing else may be added to it.
  const filled = pageFillsCanvas(page);
  // The magazine's footer is taller than this issue's pages have room for, so
  // the canvas (and the reader) draw the smaller one it was made with until the
  // author says otherwise — see FooterUpdateNotice.
  const footerBehind = footerHeldBack(magazineFooter, issue);

  return (
    <div className="bg-card relative flex h-dvh flex-col">
      <EditorHeader
        title={title}
        onTitleChange={setTitle}
        issueNumber={issue.number}
        themes={themes}
        themeId={themeId}
        onSelectTheme={setThemeId}
        logos={logos}
        logoId={logoId}
        onSelectLogo={setLogoId}
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

        <div className="bg-canvas relative flex flex-1 flex-col overflow-hidden">
          {footerBehind && page && !page.cover && !filled && (
            <FooterUpdateNotice issueId={issue.id} flushSave={flushSave} />
          )}

          <div
            ref={stageRef}
            onClick={() => {
              // A drag-pan ends in a click; don't let it deselect the block.
              if (consumeClickSuppression()) return;
              deselect();
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ paddingBottom: TOOLBAR_RESERVE }}
            className={`flex flex-1 items-center justify-center overflow-hidden px-10 pt-10 ${
              panning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            <div
              ref={panRef}
              className="shadow-[0_10px_30px_rgba(40,36,28,0.14)]"
            >
              <ScaledPage scale={scale}>
                <PageFrame
                  theme={theme}
                  w={PAGE_W}
                  h={PAGE_H}
                  issueNo={issue.number}
                  pageNo={curPage + 1}
                  logo={logo}
                  settings={settings}
                  clip={false}
                  cover={page?.cover}
                  bleed={filled}
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
                        ref={canvasRef}
                        className={
                          page?.cover
                            ? "flex min-h-full flex-col justify-center"
                            : "relative flow-root"
                        }
                      >
                        {page && page.blocks.length === 0 && (
                          <div className="text-faint2 py-16 text-center font-serif text-sm">
                            This page is empty. Add a block below.
                          </div>
                        )}
                        {page?.blocks.map((b) => (
                          <EditorBlock
                            // Remounting is how a rewrite behind an
                            // uncontrolled editor's back (a split, an undo) lands.
                            key={`${b.id}:${reseed[b.id] ?? 0}`}
                            block={b}
                            theme={theme}
                            cover={page.cover}
                            selected={b.id === sel}
                            issueId={issue.id}
                            images={images}
                            sponsors={sponsors}
                            sponsorMap={sponsorMap}
                            overflowAt={
                              overflow?.id === b.id
                                ? overflow.markerTop
                                : undefined
                            }
                            fitsAlone={overflow?.fitsAlone}
                            onSelect={() => setSel(b.id)}
                            onChange={(patch) => updateBlock(b.id, patch)}
                            onMove={(dir) => moveBlock(b.id, dir)}
                            onRemove={() => removeBlock(b.id)}
                            onFlow={() => flow(b.id)}
                            onFillPage={(a) => fillPage(b.id, a)}
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

          <EditorToolbar
            onAddBlock={addBlock}
            insertDisabled={filled}
            onToggleCover={toggleCover}
            coverDisabled={curPage === 0}
            coverActive={Boolean(page?.cover)}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            notice={historyNotice}
          />
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
