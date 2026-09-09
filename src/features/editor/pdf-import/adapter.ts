import { z } from "zod";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFWorker,
} from "pdfjs-dist/types/src/display/api";
import {
  PDF_LIMITS,
  checkAbort,
  yieldTask,
  type Run,
  type SourcePage,
} from "./model";
import { groupRuns, union } from "./grouping";
import { imageRegions } from "./image-regions";

const ASSETS = "/pdfjs/6.3.289/";
const runSchema = z.object({
  str: z.string(),
  transform: z.array(z.number().finite()).length(6),
  width: z.number().finite(),
  height: z.number().finite(),
  fontName: z.string(),
});
const fontSchema = z.object({
  name: z.string().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});
export function fileError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException")
    return "This PDF is password protected. Choose an unlocked copy.";
  return "Could not read this PDF. Choose a valid, unlocked PDF with selectable text.";
}

/** Owns one actual Worker. Cancellation terminates it, including in-flight parsing. */
export class PdfSource {
  private lifetime = new AbortController();
  private worker: Worker | null = null;
  private pdfWorker: PDFWorker | null = null;
  private task: PDFDocumentLoadingTask | null = null;
  private doc: PDFDocumentProxy | null = null;
  private cache = new Map<number, SourcePage>();
  private proxies = new Map<number, PDFPageProxy>();
  private closed = false;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  pageCount = 0;

  async open(file: File, signal: AbortSignal) {
    signal = AbortSignal.any([signal, this.lifetime.signal]);
    if (!file.size)
      throw new Error("This file is empty. Choose a PDF with pages.");
    if (file.size > PDF_LIMITS.bytes)
      throw new Error("PDF is too large. The limit is 40 MiB.");
    if (file.type && file.type !== "application/pdf")
      throw new Error("Choose a PDF file.");
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...signature) !== "%PDF-")
      throw new Error("This file does not have a PDF signature.");
    await this.operation(signal, async () => {
      const pdf = await import("pdfjs-dist");
      const data = new Uint8Array(await file.arrayBuffer());
      checkAbort(signal);
      this.worker = new Worker(`${ASSETS}pdf.worker.min.mjs`, {
        type: "module",
        name: "octavo-pdf",
      });
      this.pdfWorker = pdf.PDFWorker.create({
        port: this.worker,
        verbosity: 0,
      });
      this.task = pdf.getDocument({
        data,
        worker: this.pdfWorker,
        verbosity: 0,
        disableFontFace: true,
        useSystemFonts: false,
        useWasm: false,
        isImageDecoderSupported: false,
        maxImageSize: PDF_LIMITS.imagePixels,
        canvasMaxAreaInBytes: PDF_LIMITS.canvasPixels * 4,
        cMapUrl: `${ASSETS}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${ASSETS}standard_fonts/`,
        enableXfa: false,
      });
      try {
        this.doc = await this.task.promise;
      } catch (error) {
        throw new Error(fileError(error));
      }
      this.pageCount = this.doc.numPages;
      if (!this.pageCount) throw new Error("This PDF has no pages.");
      if (this.pageCount > PDF_LIMITS.pages)
        throw new Error(
          "This PDF exceeds the 100 source-page limit. Choose a shorter PDF.",
        );
    });
  }

  async page(number: number, signal: AbortSignal): Promise<SourcePage> {
    signal = AbortSignal.any([signal, this.lifetime.signal]);
    const cached = this.cache.get(number);
    if (cached) {
      this.cache.delete(number);
      this.cache.set(number, cached);
      return cached;
    }
    return this.operation(signal, async () => {
      if (!this.doc) throw new Error("Choose the PDF again to continue.");
      const pdf = await import("pdfjs-dist");
      const page = await this.doc.getPage(number);
      this.proxies.set(number, page);
      const viewport = page.getViewport({ scale: 1 });
      const pixelScale = Math.min(
        2,
        Math.sqrt(PDF_LIMITS.canvasPixels / (viewport.width * viewport.height)),
      );
      const renderViewport = page.getViewport({ scale: pixelScale });
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.setAttribute("aria-hidden", "true");
      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      try {
        const ops = await page.getOperatorList();
        checkAbort(signal);
        if (ops.fnArray.length > PDF_LIMITS.operations)
          throw new Error("This page is too complex. Try another page.");
        const render = page.render({
          canvas,
          viewport: renderViewport,
          annotationMode: pdf.AnnotationMode.DISABLE,
        });
        await render.promise;
        checkAbort(signal);
        const content = await page.getTextContent({
          disableNormalization: true,
          includeMarkedContent: true,
        });
        const headingIds = new Set<string>();
        let structureNodes = 0;
        const structure = await page.getStructTree().catch(() => null);
        const visit = (node: unknown, heading = false, depth = 0): void => {
          if (
            ++structureNodes > PDF_LIMITS.runs ||
            depth > 30 ||
            !node ||
            typeof node !== "object"
          )
            return;
          const parsed = z
            .object({
              role: z.string().optional(),
              id: z.string().optional(),
              children: z.array(z.unknown()).max(20000).optional(),
            })
            .safeParse(node);
          if (!parsed.success) return;
          const isHeading =
            heading || /^H[1-6]?$/u.test(parsed.data.role ?? "");
          if (isHeading && parsed.data.id) headingIds.add(parsed.data.id);
          for (const child of parsed.data.children ?? [])
            visit(child, isHeading, depth + 1);
        };
        visit(structure);
        const marked: string[] = [];
        const runs: Run[] = [];
        let textCharacters = 0;
        for (const [runIndex, raw] of content.items.entries()) {
          if (runIndex % 200 === 0) {
            checkAbort(signal);
            await yieldTask();
          }
          if ("type" in raw) {
            if (raw.type === "endMarkedContent") marked.pop();
            else marked.push("id" in raw ? raw.id : "");
            continue;
          }

          const parsed = runSchema.safeParse(raw);
          if (!parsed.success) continue;
          const item = parsed.data;
          textCharacters += item.str.length;
          if (textCharacters > PDF_LIMITS.textCharacters)
            throw new Error(
              "This page contains too much text to analyse. Try another page.",
            );
          if (!item.str.trim()) continue;
          const [a, b, c, d, e, f] = item.transform as [
            number,
            number,
            number,
            number,
            number,
            number,
          ];
          const size = Math.hypot(c, d) || Math.hypot(a, b);
          const sx = Math.hypot(a, b) || 1;
          const ascent = content.styles[item.fontName]?.ascent ?? 0.8;
          const points = [
            [0, 0],
            [item.width, 0],
            [0, size],
            [item.width, size],
          ].map(([x, y]) => {
            const [px, py] = viewport.convertToViewportPoint(
              e +
                (a / sx) * x! +
                (c / (size || 1)) * (y! - size * (1 - ascent)),
              f +
                (b / sx) * x! +
                (d / (size || 1)) * (y! - size * (1 - ascent)),
            );
            return { x: px!, y: py!, width: 0, height: 0 };
          });
          let fontName = content.styles[item.fontName]?.fontFamily ?? "";
          let bold = false,
            italic = false;
          if (page.commonObjs.has(item.fontName)) {
            const font = fontSchema.safeParse(
              page.commonObjs.get(item.fontName),
            );
            if (font.success) {
              fontName += ` ${font.data.name ?? ""}`;
              bold = Boolean(font.data.bold);
              italic = Boolean(font.data.italic);
            }
          }
          runs.push({
            ...union(points),
            text: item.str,
            taggedHeading: marked.some((id) => headingIds.has(id)),
            size,
            marks: [
              ...(bold || /bold|black|heavy/iu.test(fontName)
                ? [{ type: "bold" as const }]
                : []),
              ...(italic || /italic|oblique/iu.test(fontName)
                ? [{ type: "italic" as const }]
                : []),
            ],
          });
          if (runs.length > PDF_LIMITS.runs)
            throw new Error(
              "This page has too many text fragments. Try another page.",
            );
        }
        const regions = await groupRuns(runs, number, viewport.width, signal);
        const pictures = await imageRegions(page, ops, pdf.OPS, signal);
        // Images join the nearest text column in source order, never selection order.
        const all = [...regions, ...pictures.regions];
        for (const picture of pictures.regions) {
          const next = regions.find(
            (r) =>
              r.y >= picture.y &&
              Math.abs(r.x - picture.x) < viewport.width * 0.25,
          );
          picture.order = next ? next.order - 0.5 : regions.length;
        }
        all.sort((a, b) => a.order - b.order);
        checkAbort(signal);
        const result = {
          number,
          width: viewport.width,
          height: viewport.height,
          canvas,
          regions: all.map((r, order) => ({ ...r, order })),
          warnings: pictures.warnings,
        };
        page.cleanup();
        this.proxies.delete(number);
        this.cache.set(number, result);
        while (this.cache.size > PDF_LIMITS.cachePages)
          this.evict(this.cache.keys().next().value!);
        return result;
      } catch (error) {
        canvas.width = canvas.height = 0;
        page.cleanup();
        this.proxies.delete(number);
        throw error;
      }
    });
  }

  private async operation<T>(
    signal: AbortSignal,
    work: () => Promise<T>,
  ): Promise<T> {
    checkAbort(signal);
    if (this.closed) throw new Error("Source closed. Choose the PDF again.");
    if (this.active)
      throw new Error("Wait for the active page or cancel it first.");
    this.active = true;
    let rejectStop: (error: Error) => void = () => {};
    const stopped = new Promise<never>((_, reject) => {
      rejectStop = reject;
    });
    const abort = () => {
      this.dispose();
      rejectStop(new Error("Cancelled. Choose the PDF again to continue."));
    };
    signal.addEventListener("abort", abort, { once: true });
    this.timer = setTimeout(() => {
      rejectStop(
        new Error(
          "PDF operation exceeded 30 seconds and was stopped. Choose the PDF again or try a simpler file.",
        ),
      );
      this.dispose();
    }, PDF_LIMITS.operationMs);
    try {
      return await Promise.race([work(), stopped]);
    } finally {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.active = false;
      signal.removeEventListener("abort", abort);
    }
  }
  private evict(number: number) {
    const page = this.cache.get(number);
    if (page) page.canvas.width = page.canvas.height = 0;
    this.cache.delete(number);
    this.proxies.get(number)?.cleanup();
    this.proxies.delete(number);
  }
  dispose() {
    this.closed = true;
    this.lifetime.abort();
    this.worker?.terminate();
    this.worker = null;
    this.pdfWorker?.destroy();
    this.pdfWorker = null;
    void this.task?.destroy().catch(() => {});
    this.task = null;
    this.doc = null;
    for (const number of this.cache.keys()) this.evict(number);
    for (const page of this.proxies.values()) page.cleanup();
    this.proxies.clear();
  }
}
