"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { Page } from "@/lib/blocks";
import type { UploadCache } from "./upload";
import { PdfSource } from "./adapter";
import {
  PDF_LIMITS,
  type Region,
  type ReviewItem,
  type SourceMapping,
  type SourcePage,
} from "./model";
import { reviewItem, sourceState } from "./synthesis";
import { SourcePreview } from "./source-preview";
import { ReviewTray } from "./review-tray";

export type WorkspaceProps = {
  pages: Page[];
  destination: string;
  onClose: () => void;
  onAdd: (
    items: ReviewItem[],
    signal: AbortSignal,
    uploads: UploadCache,
  ) => Promise<SourceMapping>;
};
export default function PdfWorkspace({
  pages,
  destination,
  onClose,
  onAdd,
}: WorkspaceProps) {
  const uploads = useRef<UploadCache>(new Map());
  const source = useRef<PdfSource | null>(null);
  const operation = useRef<AbortController | null>(null);
  const addOperation = useRef<AbortController | null>(null);
  const reordered = useRef(false);
  const generation = useRef(0);
  const addLock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState<SourcePage | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [mapping, setMapping] = useState<SourceMapping>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [again, setAgain] = useState<Region | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      operation.current?.abort();
      addOperation.current?.abort();
      source.current?.dispose();
    },
    [],
  );
  const closeSource = () => {
    generation.current++;
    operation.current?.abort();
    addOperation.current?.abort();
    source.current?.dispose();
    source.current = null;
    uploads.current = new Map();
    reordered.current = false;
    setPage(null);
    setPageCount(0);
    setItems([]);
    setMapping({});
    setAgain(null);
    setBusy(false);
    setAdding(false);
    setMessage("");
  };
  const open = async (file: File) => {
    closeSource();
    const gen = generation.current;
    const controller = new AbortController();
    operation.current = controller;
    const next = new PdfSource();
    source.current = next;
    setBusy(true);
    setMessage("Opening PDF locally…");
    try {
      await next.open(file, controller.signal);
      const preview = await next.page(1, controller.signal);
      if (gen !== generation.current) return;
      setPageCount(next.pageCount);
      setPageNumber(1);
      setPage(preview);
      setMessage("PDF opened on this device. Select regions to review.");
    } catch (error) {
      if (gen === generation.current) {
        next.dispose();
        source.current = null;
        setMessage(
          error instanceof Error ? error.message : "Could not open PDF.",
        );
      }
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };
  const navigate = async (number: number) => {
    if (!source.current || busy) return;
    const gen = generation.current;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setMessage("Reading source page…");
    setPageNumber(number);
    setPage(null);
    try {
      const preview = await source.current.page(number, controller.signal);
      if (gen === generation.current) {
        setPage(preview);
        setMessage("");
      }
    } catch (error) {
      if (gen === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not read page. Try another page.",
        );
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };
  const changeItems = (next: ReviewItem[]) => {
    const bytes = next.reduce(
      (n, item) =>
        n +
        (item.region.image?.blob.size ?? 0) +
        JSON.stringify(item.block).length * 2,
      0,
    );
    if (
      next.length > PDF_LIMITS.selectionItems ||
      bytes > PDF_LIMITS.selectionBytes
    ) {
      setMessage(
        "Selection is too large. Add a smaller batch first (300 items / 64 MiB).",
      );
      return;
    }
    setItems(next);
  };
  const toggle = (region: Region, repeat = false) => {
    if (adding) return;
    if (items.some((i) => i.sources.includes(region.id))) {
      changeItems(items.filter((i) => !i.sources.includes(region.id)));
      return;
    }
    if (!repeat && sourceState(mapping[region.id] ?? [], pages)) {
      setAgain(region);
      return;
    }
    changeItems(
      reordered.current
        ? [...items, reviewItem(region)]
        : [...items, reviewItem(region)].sort(
            (a, b) => a.page - b.page || a.order - b.order,
          ),
    );
    setAgain(null);
  };
  const add = async () => {
    if (addLock.current || !items.length) return;
    addLock.current = true;
    setAdding(true);
    setMessage("Fitting selection and uploading selected images…");
    const controller = new AbortController();
    addOperation.current = controller;
    const gen = generation.current;
    try {
      const added = await onAdd(items, controller.signal, uploads.current);
      if (gen === generation.current) {
        setMapping((old) => {
          const next = { ...old };
          for (const [id, blocks] of Object.entries(added))
            next[id] = [...(next[id] ?? []), ...blocks];
          return next;
        });
        setItems([]);
        setMessage(
          "Added to the magazine. Check the editor save status before leaving.",
        );
      }
    } catch (error) {
      if (gen === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Import failed. Retry or cancel; your draft is unchanged.",
        );
    } finally {
      addLock.current = false;
      if (gen === generation.current) setAdding(false);
    }
  };
  return (
    <aside
      data-pdf-private
      className="border-line bg-card flex w-[42%] min-w-[300px] max-w-[620px] flex-none flex-col border-r"
      aria-label="PDF import workspace"
    >
      <div className="border-line space-y-2 border-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl">Import PDF</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              closeSource();
              onClose();
            }}
          >
            Close importer
          </Button>
        </div>
        <p className="text-muted text-sm">
          The PDF stays on this device. Selected text and images are saved when
          added to the magazine.
        </p>
        <label className="block text-sm">
          {pageCount ? "Replace PDF" : "Choose a PDF"}
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            aria-label="Choose local PDF"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void open(file);
            }}
            className="block w-full text-sm"
          />
        </label>
        <p className="text-muted text-xs">
          Up to 40 MiB and 100 pages. No OCR; choose an unlocked PDF.
        </p>
        {pageCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || pageNumber === 1}
              onClick={() => void navigate(pageNumber - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              PDF {pageNumber} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || pageNumber === pageCount}
              onClick={() => void navigate(pageNumber + 1)}
            >
              Next
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={zoom === 100}
              onClick={() => setZoom(Math.max(100, zoom - 25))}
            >
              −
            </Button>
            <span>{zoom}%</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={zoom === 250}
              onClick={() => setZoom(Math.min(250, zoom + 25))}
            >
              +
            </Button>
            <Button size="sm" variant="secondary" onClick={closeSource}>
              Close PDF
            </Button>
          </div>
        )}
        <p role="status" aria-live="polite" className="text-muted text-sm">
          {message}
        </p>
        {(busy || adding) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              operation.current?.abort();
              addOperation.current?.abort();
              setMessage(
                "Cancelled. Selected content remains available when possible.",
              );
            }}
          >
            Cancel operation
          </Button>
        )}
      </div>
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
        {page && (
          <>
            <SourcePreview
              page={page}
              zoom={zoom}
              selected={items}
              mapping={mapping}
              pages={pages}
              onToggle={toggle}
            />
            <div className="space-y-2 px-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={adding}
                onClick={() =>
                  changeItems(
                    [
                      ...items,
                      ...page.regions
                        .filter(
                          (r) =>
                            r.kind === "text" &&
                            !items.some((i) => i.sources.includes(r.id)) &&
                            !sourceState(mapping[r.id] ?? [], pages),
                        )
                        .map(reviewItem),
                    ].sort((a, b) =>
                      reordered.current
                        ? 0
                        : a.page - b.page || a.order - b.order,
                    ),
                  )
                }
              >
                Select text on this page
              </Button>
              {!page.regions.some((r) => r.kind === "text") && (
                <p className="text-muted text-sm">
                  No extractable text on this page. Scanned pages need OCR,
                  which is not available here.
                </p>
              )}
              {page.warnings.map((warning) => (
                <p key={warning} className="text-warn text-sm">
                  {warning}
                </p>
              ))}
            </div>
          </>
        )}
        {again && (
          <div className="border-hair m-3 space-y-2 rounded border p-3">
            <p className="text-sm">
              This region is already imported or partly present.
            </p>
            <Button size="sm" onClick={() => toggle(again, true)}>
              Import again
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAgain(null)}
            >
              Dismiss
            </Button>
          </div>
        )}
        <div className="p-3">
          <ReviewTray
            items={items}
            onChange={(next) => {
              reordered.current = true;
              changeItems(next);
            }}
            disabled={adding}
          />
        </div>
      </div>
      <div className="border-line space-y-2 border-t p-3">
        <p className="text-sm">Destination: {destination}</p>
        <Button
          full
          disabled={!items.length || adding || busy}
          onClick={() => void add()}
        >
          Add to magazine
        </Button>
      </div>
    </aside>
  );
}
