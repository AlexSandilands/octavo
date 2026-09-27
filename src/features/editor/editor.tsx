"use client";

import { useMemo, useRef, useState } from "react";
import { type IssueContent } from "@/lib/blocks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { footerHeldBack } from "@/lib/branding";
import type { FooterReserve, FooterStyle, SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { LogoListItem } from "@/lib/logos";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import { coverSources } from "@/lib/cover-elements";
import {
  enabledThemes,
  getTheme,
  normaliseEnabledThemeId,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { useEditorPages } from "./use-editor-pages";
import { usePdfInsertion } from "./pdf-import/use-pdf-insertion";
import { dragOutCollision, isPdfDrag } from "./pdf-import/drag-out";
import {
  DragOutGhost,
  usePdfDragOut,
  type DropHandler,
} from "./use-pdf-drag-out";
import {
  coverCollisionDetection,
  coverKeyboardCoordinates,
} from "./cover-drag";
import { CoverTextProvider } from "./cover-text-context";
import { usePanelDock } from "./use-panel-dock";
import { EditorStage } from "./editor-stage";
import { EditorSide } from "./editor-side";
import { PageRail } from "./page-rail";
import { PublishModal } from "./publish-modal";
import { EditorHeader } from "./editor-header";
import { EditorToolbar } from "./editor-toolbar";
import { TOOLBAR_RESERVE } from "./floating-bar";
import {
  barLayoutAtPosition,
  useBarLayout,
  type BarPosition,
} from "./use-bar-layout";
import { FooterUpdateNotice } from "./footer-update-notice";
import { useEditorAutosave } from "./use-editor-autosave";
import { useEditorFlows } from "./use-editor-flows";
import type { EditorTool } from "./side-panel/tool-rail";
import { usePanelWidth } from "./side-panel/use-panel-width";
import { useAssistantSnapshot } from "./assistant/use-assistant-snapshot";
import { useAssistantTools } from "./assistant/tools";
import { AssistantEditingNote } from "./assistant/editing-note";

// Extends FooterReserve: the footer this issue's pages were laid out against
// (issue #128) is what the canvas draws and measures overflow against, whatever
// the magazine setting has since become.
export type EditorIssue = FooterReserve & {
  id: string;
  number: number | null;
  title: string;
  theme: string;
  logoId: string | null;
  content: IssueContent;
  revision: number;
  status: string;
};

export function Editor({
  issue,
  suggestedNumber,
  images: initialImages,
  sponsors,
  logos,
  settings,
  magazineFooter,
  subscriberCount,
}: {
  issue: EditorIssue;
  /** What a draft's canvas and running head preview, and what the publish modal
   *  proposes (issue #270). Nothing is stored until publish. */
  suggestedNumber: number;
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
    applyImport,
    applyAssistant,
    curPage,
    sel,
    setSel,
    addMenu,
    setAddMenu,
    reseed,
    page,
    canUndo,
    canRedo,
    historyTop,
    historyNotice,
    undo,
    redo,
    selectPage,
    toggleCover,
    updateCoverOverlay,
    addCoverElement,
    updateCoverElement,
    removeCoverElement,
    moveCoverElement,
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
  // imageId → resolved image, seeded from the server and grown as uploads land,
  // so the canvas previews an image the moment it's uploaded.
  const [images, setImages] = useState<ImageMap>(initialImages);
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
  // Which side-panel tool is out, if any. The row ref sizes the panel.
  const [tool, setTool] = useState<EditorTool | null>(null);
  const toolPageKey = `${page?.id ?? ""}:${page?.cover ? "cover" : "interior"}`;
  const [previousToolPageKey, setPreviousToolPageKey] = useState(toolPageKey);
  // Preserve an open panel across interior pages, but close Import PDF before a
  // cover renders; the assistant stays, and the inspector steps aside for it.
  if (toolPageKey !== previousToolPageKey) {
    setPreviousToolPageKey(toolPageKey);
    if (page?.cover && tool === "pdf") setTool(null);
  }
  const rowRef = useRef<HTMLDivElement>(null);
  const panel = usePanelWidth(rowRef, tool);
  // The canvas column: its width, not the window's, decides how the tool bar
  // lays out — labels, icons only, or standing at the left edge.
  const columnRef = useRef<HTMLDivElement>(null);
  const responsiveBarLayout = useBarLayout(columnRef, {
    labels: 1000,
    // The icons-only row (cover tools, the destination toggle) measures
    // ~533px; switch to standing before a narrower canvas would clip it.
    vertical: 575,
  });
  const [barPosition, setBarPosition] = useState<BarPosition | null>(null);
  const barLayout = barLayoutAtPosition(responsiveBarLayout, barPosition);
  const [toolbarReserve, setToolbarReserve] = useState(TOOLBAR_RESERVE);
  const [pub, setPub] = useState(false);
  // Null until published (issue #270), then whatever the publish allocated —
  // which is also what defaults the modal's email off on a re-publish.
  const [number, setNumber] = useState(issue.number);
  // Published here or before: the assistant only works on drafts (#306).
  const [published, setPublished] = useState(issue.status === "published");
  const issueNo = number ?? suggestedNumber;
  // Items a pointed-at layout warning is lighting up on the page.
  const [hint, setHint] = useState<string[]>([]);

  const { status, setStatus, enqueueSave, flushSave } = useEditorAutosave({
    issueId: issue.id,
    revision: issue.revision,
    pages,
    title,
    theme: themeId,
    logoId,
  });
  const flows = useEditorFlows({
    issueId: issue.id,
    flushSave,
    onSaveError: () => setStatus("error"),
    onPublished: (n) => {
      setNumber(n);
      setPublished(true);
    },
  });

  const importer = usePdfInsertion({
    pages,
    curPage,
    sel,
    issueId: issue.id,
    flushSave,
    applyImport,
    theme: getTheme(themeId),
    images,
    sponsors: sponsorMap,
    settings,
    logo,
    issueNo,
    registerImages: (added) => setImages((old) => ({ ...old, ...added })),
  });

  // Drag from the handle, or move with the keyboard once the handle is focused.
  // A small distance threshold lets a plain click on the handle still select.
  // Blocks and PDF regions alike lift after a short travel (`drag-out.ts`); on
  // a cover the anchors, not a list, decide where a keyboard move lands.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: page?.cover
        ? coverKeyboardCoordinates
        : sortableKeyboardCoordinates,
    }),
  );
  // A PDF region in hand keeps its own targeting; cover items drop onto the
  // item under the pointer; ordinary blocks sort by nearest centre.
  const collision: CollisionDetection = (args) =>
    isPdfDrag(args.active.id) || !page?.cover
      ? dragOutCollision(args)
      : coverCollisionDetection(args);

  const theme = getTheme(themeId);
  // This page is owned by a full-bleed photo (issue #227): no page furniture,
  // and nothing else may be added to it — except on a cover, whose content
  // overlays the photo.
  const filled = pageFillsCanvas(page);
  const showCoverTools = Boolean(page?.cover || page?.coverElements?.length);
  // Section titles the cover can reference; derived once per change of pages.
  const sources = useMemo(() => coverSources(pages), [pages]);
  const docking = usePanelDock();
  // A region dragged out of the PDF panel: previewed in place on this page and,
  // dropped, added through the panel's own Add (it sets `dropRef`).
  const dropRef = useRef<DropHandler | null>(null);
  const dragOut = usePdfDragOut({
    page,
    curPage,
    images,
    previewable: Boolean(page) && !page?.cover && !filled,
    drop: dropRef,
  });
  // The magazine's footer is taller than this issue's pages have room for, so
  // the canvas (and the reader) draw the smaller one it was made with until the
  // author says otherwise — see FooterUpdateNotice.
  const footerBehind = footerHeldBack(magazineFooter, issue);
  const assistantSnapshot = useAssistantSnapshot({
    title,
    theme: themeId,
    pages,
    curPage,
    logos,
    sponsors,
    measure: { theme, images, sponsors: sponsorMap, settings, logo, issueNo },
  });
  const assistantTools = useAssistantTools({
    state: { pages, curPage, sel },
    apply: applyAssistant,
    measure: { theme, images, sponsors: sponsorMap, settings, logo, issueNo },
    source: { issueId: issue.id, logoId },
  });

  return (
    <CoverTextProvider selectedId={sel}>
      <div
        className="bg-card relative flex h-dvh flex-col"
        data-import-pending={importer.pending}
        data-assistant-running={assistantTools.running}
      >
        <div inert={importer.pending || assistantTools.running}>
          <EditorHeader
            title={title}
            onTitleChange={setTitle}
            issueNumber={number}
            themes={themes}
            themeId={themeId}
            onSelectTheme={setThemeId}
            logos={logos}
            logoId={logoId}
            onSelectLogo={setLogoId}
            status={status}
            onRetrySave={() => void enqueueSave("all")}
            onReload={() => window.location.reload()}
            onPreview={flows.preview}
            onPublish={() => setPub(true)}
          />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={dragOut.onDragStart}
          onDragMove={dragOut.onDragMove}
          onDragEnd={(e) => {
            if (!dragOut.onDragEnd(e)) onDragEnd(e);
          }}
          onDragCancel={dragOut.onDragCancel}
        >
          <div ref={rowRef} className="flex flex-1 overflow-hidden">
            <div inert={importer.pending} className="flex">
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
            </div>
            <div
              ref={columnRef}
              inert={importer.pending || assistantTools.running}
              className="bg-canvas relative flex min-w-0 flex-1 flex-col overflow-hidden"
            >
              {assistantTools.running && <AssistantEditingNote />}
              {/* Not while the inspector is up: it spans the stage's height. */}
              {footerBehind &&
                page &&
                !page.cover &&
                !filled &&
                !showCoverTools && (
                  <FooterUpdateNotice
                    issueId={issue.id}
                    flushSave={flushSave}
                  />
                )}

              <EditorStage
                issueId={issue.id}
                issueNo={issueNo}
                page={page}
                curPage={curPage}
                sel={sel}
                theme={theme}
                logo={logo}
                settings={settings}
                filled={filled}
                barStanding={barLayout === "vertical"}
                barReserve={toolbarReserve}
                images={images}
                sponsors={sponsors}
                sponsorMap={sponsorMap}
                reseed={reseed}
                preview={dragOut.preview}
                onSelect={setSel}
                actions={{
                  updateBlock,
                  moveBlock,
                  removeBlock,
                  fillPage,
                  flowText,
                  moveToNextPage,
                  registerImage: (imageId, image) =>
                    setImages((m) => ({ ...m, [imageId]: image })),
                }}
                cover={
                  showCoverTools
                    ? {
                        pages,
                        sources,
                        logos,
                        // Also off when the owner has hidden the running head
                        // site-wide (issue #269) — no switch that does nothing.
                        hasMasthead:
                          theme.page.hasMasthead && settings.showRunningHead,
                        hint,
                        onHint: setHint,
                        docking,
                        inspector: tool !== "assistant",
                        updateOverlay: updateCoverOverlay,
                        updateElement: updateCoverElement,
                        removeElement: removeCoverElement,
                        moveElement: moveCoverElement,
                      }
                    : undefined
                }
              />

              <EditorToolbar
                layout={barLayout}
                onAddBlock={addBlock}
                insertDisabled={filled && !page?.cover}
                onToggleCover={toggleCover}
                coverDisabled={curPage === 0}
                coverActive={Boolean(page?.cover)}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onTogglePosition={() =>
                  setBarPosition(barLayout === "vertical" ? "bottom" : "left")
                }
                onReserveChange={setToolbarReserve}
                notice={historyNotice}
                onAddCoverElement={addCoverElement}
                coverElementCount={page?.coverElements?.length ?? 0}
              />
            </div>
            <EditorSide
              tool={tool}
              onToggle={(next) => setTool(tool === next ? null : next)}
              onClose={() => setTool(null)}
              pending={importer.pending}
              cover={Boolean(page?.cover)}
              panel={panel}
              pages={pages}
              onAdd={importer.add}
              dropRef={dropRef}
              assistant={{
                issueId: issue.id,
                published,
                snapshot: assistantSnapshot,
                tools: assistantTools,
                target: {
                  page: curPage + 1,
                  blockId: page?.blocks.some((b) => b.id === sel) ? sel : null,
                },
                undo,
                historyTop,
              }}
            />
          </div>
          <DragOutGhost
            dragOut={dragOut}
            page={page}
            curPage={curPage}
            filled={filled}
          />
        </DndContext>

        {pub && (
          <PublishModal
            number={number}
            subscriberCount={subscriberCount}
            suggestedNumber={suggestedNumber}
            onClose={() => setPub(false)}
            onPublish={flows.publish}
          />
        )}
      </div>
    </CoverTextProvider>
  );
}
