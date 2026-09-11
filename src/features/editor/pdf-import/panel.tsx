"use client";

import { useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/blocks";
import type { RailAction } from "../side-panel/tool-rail";
import { StageBadge } from "../stage-badge";
import { useBarLayout } from "../use-bar-layout";
import { DropZone } from "./drop-zone";
import type { ImportKind, Region, ReviewItem, SourceMapping } from "./model";
import { PageDock } from "./page-dock";
import { PageStage } from "./page-stage";
import { PageView } from "./page-view";
import { SelectionList } from "./selection-list";
import type { UploadCache } from "./upload";
import { useAddSelection } from "./use-add-selection";
import { useFileDrop } from "./use-file-drop";
import { useImportSelection } from "./use-import-selection";
import { usePdfSource } from "./use-pdf-source";

export type PdfImportPanelProps = {
  pages: Page[];
  onAdd: (
    items: ReviewItem[],
    signal: AbortSignal,
    uploads: UploadCache,
  ) => Promise<SourceMapping>;
  /** The tool's rail actions, as they change: Replace PDF while a file is open. */
  onRailActions: (actions: RailAction[]) => void;
};

// The Import PDF tool: open a local PDF, pick regions on its pages, add them to
// the issue. Once a file is open the panel is a stage like the editor's canvas
// with the tools floating at the foot; the file's own controls live on the rail.
// `data-pdf-private` keeps browser telemetry quiet while it is open.
export default function PdfImportPanel({
  pages,
  onAdd,
  onRailActions,
}: PdfImportPanelProps) {
  const source = usePdfSource();
  const selection = useImportSelection(pages);
  const batch = useAddSelection(onAdd);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Room for the bar with labels, then icons only; below that it stands.
  const layout = useBarLayout(root, { labels: 768, vertical: 512 });
  const [listOpen, setListOpen] = useState(false);

  const openFile = (file: File) => {
    batch.reset();
    selection.forget();
    setListOpen(false);
    void source.open(file);
  };
  const drop = useFileDrop(openFile, !batch.adding);
  const { loaded, name } = source;
  const adding = batch.adding;
  useEffect(() => {
    onRailActions(
      loaded
        ? [
            {
              id: "replace",
              icon: "refresh",
              label: "Replace PDF",
              hint: `Replace ${name} with another PDF`,
              disabled: adding,
              onClick: () => input.current?.click(),
            },
          ]
        : [],
    );
    return () => onRailActions([]);
  }, [loaded, name, adding, onRailActions]);
  const add = () =>
    void batch.add(selection.items, (added) => {
      selection.markAdded(added);
      selection.clear();
      setListOpen(false);
    });
  const split = (region: Region) => {
    selection.dropSource(region.id);
    source.split(region.id);
  };
  const setKind = (region: Region, kind: ImportKind) =>
    selection.setKind(region, kind);
  const busy = batch.adding;
  const status =
    batch.status ??
    (selection.limit ? { text: selection.limit, tone: "warn" as const } : null);
  const showList = listOpen && selection.items.length > 0;

  return (
    <div
      ref={root}
      data-pdf-private
      {...drop.handlers}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <StageBadge>PDF</StageBadge>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) openFile(file);
        }}
      />
      {!source.loaded ? (
        <DropZone
          over={drop.over}
          opening={source.busy}
          error={source.error}
          onPick={() => input.current?.click()}
        />
      ) : (
        <div className="bg-canvas relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {source.page ? (
            <PageStage page={source.page} barStanding={layout === "vertical"}>
              <PageView
                page={source.page}
                addCount={selection.items.length}
                disabled={busy}
                itemFor={selection.itemFor}
                stateOf={selection.stateOf}
                onToggle={selection.toggle}
                onKind={setKind}
                onSplit={split}
                onAdd={add}
              />
            </PageStage>
          ) : (
            <p
              role="status"
              className="text-faint flex flex-1 items-center justify-center px-6 text-center font-serif text-[15px]"
            >
              {source.error || "Reading page…"}
            </p>
          )}
          <PageNotes page={source.page} />
          <PageDock
            layout={layout}
            pageNumber={source.pageNumber}
            pageCount={source.pageCount}
            busy={source.busy}
            count={selection.items.length}
            listOpen={showList}
            canSelectAll={Boolean(
              source.page?.regions.some((r) => !selection.itemFor(r.id)),
            )}
            adding={busy}
            status={status}
            onNavigate={(n) => void source.navigate(n)}
            onToggleList={() => setListOpen((v) => !v)}
            onSelectAll={() => source.page && selection.selectAll(source.page)}
            onClear={selection.clear}
            onAdd={add}
            onCancel={batch.cancel}
          >
            {showList && (
              <SelectionList
                items={selection.items}
                disabled={busy}
                onKind={setKind}
                onMove={selection.move}
                onRemove={selection.remove}
              />
            )}
          </PageDock>
          {drop.over && (
            <div className="bg-accent-wash/90 border-accent text-accent pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed font-serif text-[20px]">
              Drop to replace the PDF
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Per-page notes float at the top of the stage.
function PageNotes({
  page,
}: {
  page: ReturnType<typeof usePdfSource>["page"];
}) {
  if (!page) return null;
  const empty = !page.regions.some((r) => r.kind === "text");
  if (!empty && !page.warnings.length) return null;
  return (
    <div className="pointer-events-none absolute top-3 right-4 left-24 z-20 flex justify-center">
      <div className="border-hair-warm max-w-[520px] space-y-1 rounded-[12px] border bg-white/95 px-3.5 py-2 text-center text-[13px] leading-snug shadow-[0_4px_14px_rgba(40,36,28,0.12)]">
        {empty && (
          <p className="text-faint">
            No text can be picked up from this page: a scanned page has no
            selectable text. Photos can still be added.
          </p>
        )}
        {page.warnings.map((warning) => (
          <p key={warning} className="text-warn">
            {warning}
          </p>
        ))}
      </div>
    </div>
  );
}
