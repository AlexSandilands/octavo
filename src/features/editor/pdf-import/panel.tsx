"use client";

import { useRef, useState } from "react";
import type { Page } from "@/lib/blocks";
import { DropZone } from "./drop-zone";
import type { ImportKind, Region, ReviewItem, SourceMapping } from "./model";
import { PageDock } from "./page-dock";
import { PageView } from "./page-view";
import { SelectionBar } from "./selection-bar";
import { SelectionList } from "./selection-list";
import { SourceBar } from "./source-bar";
import type { UploadCache } from "./upload";
import { useAddSelection } from "./use-add-selection";
import { useFileDrop } from "./use-file-drop";
import { useImportSelection } from "./use-import-selection";
import { usePdfSource } from "./use-pdf-source";

export type PdfImportPanelProps = {
  pages: Page[];
  /** Where the next Add lands, in words ("after the selected block on page 2"). */
  destination: string;
  onAdd: (
    items: ReviewItem[],
    signal: AbortSignal,
    uploads: UploadCache,
  ) => Promise<SourceMapping>;
};

// The Import PDF tool: open a local PDF, pick regions on its pages, add them to
// the draft. `data-pdf-private` keeps browser telemetry quiet while it is open.
export default function PdfImportPanel({
  pages,
  destination,
  onAdd,
}: PdfImportPanelProps) {
  const source = usePdfSource();
  const selection = useImportSelection(pages);
  const batch = useAddSelection(onAdd);
  const input = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(100);
  const [listOpen, setListOpen] = useState(false);

  const openFile = (file: File) => {
    batch.reset();
    selection.forget();
    setListOpen(false);
    setZoom(100);
    void source.open(file);
  };
  const closeFile = () => {
    batch.reset();
    selection.forget();
    setListOpen(false);
    source.close();
  };
  const drop = useFileDrop(openFile, !batch.adding);
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

  return (
    <div
      data-pdf-private
      {...drop.handlers}
      className="relative flex min-h-0 flex-1 flex-col"
    >
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
        <>
          <SourceBar
            name={source.name}
            disabled={busy}
            onReplace={() => input.current?.click()}
            onClose={closeFile}
          />
          <SelectionBar
            count={selection.items.length}
            listOpen={listOpen && selection.items.length > 0}
            canSelectAll={Boolean(
              source.page?.regions.some((r) => !selection.itemFor(r.id)),
            )}
            adding={busy}
            status={status}
            destination={destination}
            onToggleList={() => setListOpen((v) => !v)}
            onSelectAll={() => source.page && selection.selectAll(source.page)}
            onClear={selection.clear}
            onAdd={add}
            onCancel={batch.cancel}
          />
          {listOpen && selection.items.length > 0 && (
            <SelectionList
              items={selection.items}
              disabled={busy}
              onKind={setKind}
              onMove={selection.move}
              onRemove={selection.remove}
            />
          )}
          <div className="relative min-h-0 flex-1">
            <div className="scrollbar-soft bg-stage absolute inset-0 overflow-auto p-4 pb-24 [--scrollbar-surface:var(--color-stage)]">
              {source.page ? (
                <PageView
                  page={source.page}
                  zoom={zoom}
                  addCount={selection.items.length}
                  disabled={busy}
                  itemFor={selection.itemFor}
                  stateOf={selection.stateOf}
                  onToggle={selection.toggle}
                  onKind={setKind}
                  onSplit={split}
                  onAdd={add}
                />
              ) : (
                <p
                  role="status"
                  className="text-faint py-16 text-center font-serif text-[15px]"
                >
                  {source.error || "Reading page…"}
                </p>
              )}
              <PageNotes page={source.page} />
            </div>
            <PageDock
              pageNumber={source.pageNumber}
              pageCount={source.pageCount}
              zoom={zoom}
              busy={source.busy}
              onNavigate={(n) => void source.navigate(n)}
              onZoom={setZoom}
            />
            {drop.over && (
              <div className="bg-accent-wash/90 border-accent text-accent pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed font-serif text-[20px]">
                Drop to replace the PDF
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PageNotes({
  page,
}: {
  page: ReturnType<typeof usePdfSource>["page"];
}) {
  if (!page) return null;
  const empty = !page.regions.some((r) => r.kind === "text");
  if (!empty && !page.warnings.length) return null;
  return (
    <div className="mx-auto mt-3 max-w-[520px] space-y-1 text-center text-[13px] leading-snug">
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
  );
}
