import { z } from "zod";
import type {
  PDFPageProxy,
  PDFOperatorList,
} from "pdfjs-dist/types/src/display/api";
import {
  PDF_LIMITS,
  checkAbort,
  yieldTask,
  boundedWait,
  type Region,
} from "./model";
import { union } from "./grouping";
import { cropOf, type Matrix, type Pixels, type Rect } from "./image-crop";

const matrixSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
// PDF.js hands a matrix over as a plain array or, for a form's placement, a
// Float32Array; either reads as six numbers.
const readMatrix = (raw: unknown): Matrix =>
  matrixSchema.parse(
    ArrayBuffer.isView(raw) ? Array.from(raw as Float32Array) : raw,
  );
const identity: Matrix = [1, 0, 0, 1, 0, 0];
const clipped =
  "Clipped, masked or composite artwork stays visible but cannot be faithfully extracted.";
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
const imageSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  kind: z.number().optional(),
  data: z.unknown().optional(),
  bitmap: z.unknown().optional(),
});
// Encodes the image, or only the `crop` of it the page shows.
async function encode(
  raw: unknown,
  crop: Pixels | null,
  signal: AbortSignal,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = imageSchema.parse(raw);
  if (img.width * img.height > PDF_LIMITS.imagePixels)
    throw new Error("Image exceeds 16 megapixels.");
  const { x, y, width, height } = crop ?? {
    x: 0,
    y: 0,
    width: img.width,
    height: img.height,
  };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image canvas unavailable.");
    if (img.bitmap instanceof ImageBitmap)
      ctx.drawImage(img.bitmap, x, y, width, height, 0, 0, width, height);
    else if (
      img.data instanceof Uint8Array ||
      img.data instanceof Uint8ClampedArray
    ) {
      const source = img.data;
      const pixels = new Uint8ClampedArray(img.width * img.height * 4);
      if (img.kind !== 2 && img.kind !== 3)
        throw new Error("Unsupported raster encoding.");
      const stride = img.kind === 2 ? 3 : 4;
      for (let i = 0; i < img.width * img.height; i++) {
        if (i % 65536 === 0) {
          checkAbort(signal);
          await yieldTask();
        }
        pixels[i * 4] = source[i * stride]!;
        pixels[i * 4 + 1] = source[i * stride + 1]!;
        pixels[i * 4 + 2] = source[i * stride + 2]!;
        pixels[i * 4 + 3] = stride === 4 ? source[i * stride + 3]! : 255;
      }
      const data = new ImageData(pixels, img.width, img.height);
      ctx.putImageData(data, -x, -y, x, y, width, height);
    } else throw new Error("Unsupported raster image.");
    const blob = await boundedWait(
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))),
          "image/png",
        ),
      ),
      signal,
    );
    return { blob, width, height };
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function imageRegions(
  page: PDFPageProxy,
  ops: PDFOperatorList,
  names: Record<string, number>,
  signal: AbortSignal,
): Promise<{ regions: Region[]; warnings: string[] }> {
  if (ops.fnArray.length > PDF_LIMITS.operations)
    throw new Error("This page is too complex. Try another page.");
  const viewport = page.getViewport({ scale: 1 });
  let matrix = identity;
  let unsupported = false;
  let clipping = false;
  let clips: Rect[] = [];
  const stack: { matrix: Matrix; unsupported: boolean; clips: Rect[] }[] = [];
  // The crop box crops like any clip: what lies beyond it is never seen.
  const [vx0, vy0, vx1, vy1] = page.view;
  const pageClip: Rect = {
    x0: Math.min(vx0!, vx1!),
    y0: Math.min(vy0!, vy1!),
    x1: Math.max(vx0!, vx1!),
    y1: Math.max(vy0!, vy1!),
  };
  const regions: Region[] = [];
  const warnings = new Set<string>();
  let decodedPixels = 0,
    encodedBytes = 0,
    occurrences = 0;
  const decoded = new Map<string, Awaited<ReturnType<typeof encode>>>();
  const add = async (raw: unknown, key: string, placement: Matrix) => {
    checkAbort(signal);
    if (++occurrences % 20 === 0) await yieldTask();
    if (regions.length >= PDF_LIMITS.imageOccurrences) {
      warnings.add(
        "This page exceeds the 200 selectable image-occurrence limit.",
      );
      return;
    }
    if (unsupported) {
      warnings.add(clipped);
      return;
    }
    try {
      const dimensions = imageSchema.parse(raw);
      const crop = cropOf(
        placement,
        [...clips, pageClip],
        dimensions.width,
        dimensions.height,
      );
      // Rotated or skewed artwork can't be cut to a rectangle of its pixels.
      if (crop === "skewed") {
        warnings.add(clipped);
        return;
      }
      if (!crop) return;
      const cut = crop.pixels;
      const cacheKey = cut
        ? `${key}#${cut.x},${cut.y},${cut.width},${cut.height}`
        : key;
      let img = decoded.get(cacheKey);
      if (!img) {
        const pixels = dimensions.width * dimensions.height;
        if (decodedPixels + pixels > PDF_LIMITS.pageImagePixels) {
          warnings.add(
            "This page exceeds the 32 megapixel decoded-image budget. Some images remain preview-only.",
          );
          return;
        }
        img = await encode(raw, cut, signal);
        if (encodedBytes + img.blob.size > PDF_LIMITS.pageImageBytes) {
          warnings.add(
            "This page exceeds the 32 MiB image-preview budget. Some images remain preview-only.",
          );
          return;
        }
        decodedPixels += pixels;
        encodedBytes += img.blob.size;
        decoded.set(cacheKey, img);
      }
      const { x0, y0, x1, y1 } = crop.rect;
      const points = [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ].map(([x, y]) => {
        const [px, py] = viewport.convertToViewportPoint(x!, y!);
        return { x: px!, y: py!, width: 0, height: 0 };
      });
      const box = union(points);
      regions.push({
        ...box,
        id: `${page.pageNumber}:i:${regions.length}`,
        page: page.pageNumber,
        order: 0,
        kind: "image",
        doc: { type: "doc", content: [] },
        heading: false,
        level: "paragraph",
        size: "m",
        align: "left",
        image: { ...img, key: `${page.pageNumber}:${cacheKey}` },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      warnings.add(
        "Some images use an unsupported encoding or exceed the 16 megapixel limit.",
      );
    }
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (i % 100 === 0) {
      checkAbort(signal);
      await yieldTask();
    }
    const op = ops.fnArray[i];
    const args: unknown[] = ops.argsArray[i] ?? [];
    if (op === names.save)
      stack.push({ matrix, unsupported, clips: [...clips] });
    else if (op === names.restore) {
      const state = stack.pop();
      if (state) ({ matrix, unsupported, clips } = state);
    } else if (op === names.transform)
      matrix = multiply(matrix, readMatrix(args));
    else if (op === names.paintFormXObjectBegin) {
      stack.push({ matrix, unsupported, clips: [...clips] });
      if (args[0]) matrix = multiply(matrix, readMatrix(args[0]));
      if (args[1]) unsupported = true;
    } else if (op === names.paintFormXObjectEnd) {
      const state = stack.pop();
      if (state) ({ matrix, unsupported, clips } = state);
    } else if (op === names.clip || op === names.eoClip) clipping = true;
    else if (op === names.constructPath && clipping) {
      clipping = false;
      const paths = args[1];
      const path = Array.isArray(paths) && paths.length === 1 ? paths[0] : null;
      if (
        !(path instanceof Float32Array) ||
        path.length !== 13 ||
        path[0] !== 0 ||
        path[3] !== 1 ||
        path[6] !== 1 ||
        path[9] !== 1 ||
        path[12] !== 4 ||
        matrix[1] !== 0 ||
        matrix[2] !== 0
      )
        unsupported = true;
      else {
        const xs = [path[1]!, path[4]!, path[7]!, path[10]!].map(
          (x) => matrix[0] * x + matrix[4],
        );
        const ys = [path[2]!, path[5]!, path[8]!, path[11]!].map(
          (y) => matrix[3] * y + matrix[5],
        );
        const rectangular = new Set(xs).size === 2 && new Set(ys).size === 2;
        if (!rectangular) unsupported = true;
        else
          clips.push({
            x0: Math.min(...xs),
            y0: Math.min(...ys),
            x1: Math.max(...xs),
            y1: Math.max(...ys),
          });
      }
    } else if (op === names.beginGroup) unsupported = true;
    else if (op === names.setGState) {
      const entries = z
        .array(z.tuple([z.string(), z.unknown()]))
        .safeParse(args[0]);
      if (
        !entries.success ||
        entries.data.some(
          ([key, value]) =>
            (key === "SMask" && value !== false && value !== null) ||
            (key === "BM" && value !== "source-over" && value !== "Normal") ||
            ((key === "ca" || key === "CA") && value !== 1),
        )
      )
        unsupported = true;
    } else if (
      op === names.paintImageXObject ||
      op === names.paintImageXObjectRepeat
    ) {
      const id = z.string().parse(args[0]);
      const raw: unknown = id.startsWith("g_")
        ? page.commonObjs.get(id)
        : page.objs.get(id);
      if (op === names.paintImageXObject) await add(raw, id, matrix);
      else {
        const positions = z
          .union([z.array(z.number()), z.instanceof(Float32Array)])
          .parse(args[3]);
        const sx = z.number().parse(args[1]),
          sy = z.number().parse(args[2]);
        for (let j = 0; j < positions.length; j += 2)
          await add(
            raw,
            id,
            multiply(matrix, [sx, 0, 0, sy, positions[j]!, positions[j + 1]!]),
          );
      }
    } else if (op === names.paintInlineImageXObject)
      await add(args[0], `inline:${i}`, matrix);
    else if (
      [
        names.paintImageMaskXObject,
        names.paintImageMaskXObjectGroup,
        names.paintInlineImageXObjectGroup,
      ].includes(op)
    )
      warnings.add(
        "Masks and grouped artwork are visible only; choose an ordinary photo instead.",
      );
  }
  return { regions, warnings: [...warnings] };
}
