import type { Block, TextAlign, TextSize } from "@/lib/blocks";
import type { RichDoc, RichMark } from "@/lib/rich-text-doc";

export const PDF_LIMITS = {
  bytes: 40 * 1024 * 1024,
  pages: 100,
  imagePixels: 16_000_000,
  pageImagePixels: 32_000_000,
  pageImageBytes: 32 * 1024 * 1024,
  imageOccurrences: 200,
  canvasPixels: 8_000_000,
  cachePages: 3,
  operationMs: 30_000,
  runs: 20_000,
  textCharacters: 2_000_000,
  operations: 100_000,
  selectionItems: 300,
  selectionBytes: 64 * 1024 * 1024,
} as const;
export type Box = { x: number; y: number; width: number; height: number };
export type Run = Box & {
  text: string;
  size: number;
  marks: RichMark[];
  taggedHeading?: boolean;
};
export type Region = Box & {
  id: string;
  page: number;
  order: number;
  kind: "text" | "image";
  doc: RichDoc;
  heading: boolean;
  level: "main" | "section" | "paragraph";
  size: TextSize;
  align: TextAlign;
  image?: { blob: Blob; width: number; height: number; key: string };
  /** The grouped source lines, kept so a region can be split with real geometry. */
  lines?: Run[][];
  warning?: string;
};
export type ImportKind = "heading" | "text" | "image";
export type SourcePage = {
  number: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  regions: Region[];
  warnings: string[];
};
export type ReviewItem = {
  id: string;
  sources: string[];
  page: number;
  order: number;
  region: Region;
  block: Block;
};
export type SourceMapping = Record<string, string[]>;
export const yieldTask = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));
export function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Cancelled. The issue is unchanged.");
}

export function boundedWait<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  ms: number = PDF_LIMITS.operationMs,
): Promise<T> {
  checkAbort(signal);
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Cancelled. The issue is unchanged."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Operation timed out. Try a smaller selection."));
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}
