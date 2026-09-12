"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type IssueContent } from "@/lib/blocks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { footerHeldBack } from "@/lib/branding";
import type { FooterReserve, FooterStyle, SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { LogoListItem } from "@/lib/logos";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import {
  enabledThemes,
  getTheme,
  normaliseEnabledThemeId,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { useEditorPages } from "./use-editor-pages";
import { usePdfInsertion } from "./pdf-import/use-pdf-insertion";
import { dragOutCollision } from "./pdf-import/drag-out";
import {
  DragOutGhost,
  usePdfDragOut,
  type DropHandler,
} from "./use-pdf-drag-out";
import { EditorStage } from "./editor-stage";
import { EditorSide } from "./editor-side";
import { reportEditorError } from "./report-error";
import { PageRail } from "./page-rail";
import { PublishModal } from "./publish-modal";
import { EditorHeader } from "./editor-header";
import { EditorToolbar } from "./editor-toolbar";
import { useBarLayout } from "./use-bar-layout";
import { FooterUpdateNotice } from "./footer-update-notice";
import { useEditorAutosave } from "./use-editor-autosave";
import { publishIssueAction } from "@/app/admin/actions";

import type { EditorTool } from "./side-panel/tool-rail";
import { usePanelWidth } from "./side-panel/use-panel-width";

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
    applyImport,
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
  const rowRef = useRef<HTMLDivElement>(null);
  const panel = usePanelWidth(rowRef);
  // The canvas column: its width, not the window's, decides how the tool bar
  // lays out — labels, icons only, or standing at the left edge.
  const columnRef = useRef<HTMLDivElement>(null);
  const barLayout = useBarLayout(columnRef, { labels: 1000, vertical: 520 });
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
    issueNo: issue.number,
    registerImages: (added) => setImages((old) => ({ ...old, ...added })),
  });

  // Drag from the handle, or move with the keyboard once the handle is focused.
  // A small distance threshold lets a plain click on the handle still select.
  // Blocks and PDF regions alike lift after a short travel (`drag-out.ts`).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const theme = getTheme(themeId);
  // This page is owned by a full-bleed photo (issue #227): no page furniture,
  // and nothing else may be added to it.
  const filled = pageFillsCanvas(page);
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

  return (
    <div
      className="bg-card relative flex h-dvh flex-col"
      data-import-pending={importer.pending}
    >
      <div inert={importer.pending}>
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
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={dragOutCollision}
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
            inert={importer.pending}
            className="bg-canvas relative flex min-w-0 flex-1 flex-col overflow-hidden"
          >
            {footerBehind && page && !page.cover && !filled && (
              <FooterUpdateNotice issueId={issue.id} flushSave={flushSave} />
            )}

            <EditorStage
              issueId={issue.id}
              issueNo={issue.number}
              page={page}
              curPage={curPage}
              sel={sel}
              theme={theme}
              logo={logo}
              settings={settings}
              filled={filled}
              barStanding={barLayout === "vertical"}
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
            />

            <EditorToolbar
              layout={barLayout}
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
          <EditorSide
            tool={tool}
            onToggle={(next) => setTool(tool === next ? null : next)}
            onClose={() => setTool(null)}
            pending={importer.pending}
            panel={panel}
            pages={pages}
            onAdd={importer.add}
            dropRef={dropRef}
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
              if (res.ok) {
                setPublished(true);
              } else setStatus("error");
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
