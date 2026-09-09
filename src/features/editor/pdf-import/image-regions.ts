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

type Matrix = [number, number, number, number, number, number];
const matrixSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
const identity: Matrix = [1, 0, 0, 1, 0, 0];
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
async function encode(
  raw: unknown,
  signal: AbortSignal,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = imageSchema.parse(raw);
  if (img.width * img.height > PDF_LIMITS.imagePixels)
    throw new Error("Image exceeds 16 megapixels.");
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image canvas unavailable.");
    if (img.bitmap instanceof ImageBitmap) ctx.drawImage(img.bitmap, 0, 0);
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
      ctx.putImageData(new ImageData(pixels, img.width, img.height), 0, 0);
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
    return { blob, width: img.width, height: img.height };
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
  let clips: Matrix[] = [];
  const stack: { matrix: Matrix; unsupported: boolean; clips: Matrix[] }[] = [];
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
    const contained = clips.every((clip) => {
      const xs = [
        placement[4],
        placement[4] + placement[0],
        placement[4] + placement[2],
        placement[4] + placement[0] + placement[2],
      ];
      const ys = [
        placement[5],
        placement[5] + placement[1],
        placement[5] + placement[3],
        placement[5] + placement[1] + placement[3],
      ];
      return (
        Math.min(...xs) >= clip[4] - 1 &&
        Math.max(...xs) <= clip[4] + clip[0] + 1 &&
        Math.min(...ys) >= clip[5] - 1 &&
        Math.max(...ys) <= clip[5] + clip[3] + 1
      );
    });
    if (unsupported || !contained) {
      warnings.add(
        "Clipped, masked or composite artwork stays visible but cannot be faithfully extracted.",
      );
      return;
    }
    try {
      let img = decoded.get(key);
      if (!img) {
        const dimensions = imageSchema.parse(raw);
        const pixels = dimensions.width * dimensions.height;
        if (decodedPixels + pixels > PDF_LIMITS.pageImagePixels) {
          warnings.add(
            "This page exceeds the 32 megapixel decoded-image budget. Some images remain preview-only.",
          );
          return;
        }
        img = await encode(raw, signal);
        if (encodedBytes + img.blob.size > PDF_LIMITS.pageImageBytes) {
          warnings.add(
            "This page exceeds the 32 MiB image-preview budget. Some images remain preview-only.",
          );
          return;
        }
        decodedPixels += pixels;
        encodedBytes += img.blob.size;
        decoded.set(key, img);
      }
      const points = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => {
        const [px, py] = viewport.convertToViewportPoint(
          placement[0] * x! + placement[2] * y! + placement[4],
          placement[1] * x! + placement[3] * y! + placement[5],
        );
        return { x: px!, y: py!, width: 0, height: 0 };
      });
      const box = union(points);
      // A placement beyond the crop box is itself a crop, not the original photo.
      if (
        box.x < -1 ||
        box.y < -1 ||
        box.x + box.width > viewport.width + 1 ||
        box.y + box.height > viewport.height + 1
      ) {
        warnings.add(
          "A cropped image is unsupported; its original bounds extend beyond this page.",
        );
        return;
      }
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
        image: { ...img, key: `${page.pageNumber}:${key}` },
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
      matrix = multiply(matrix, matrixSchema.parse(args));
    else if (op === names.paintFormXObjectBegin) {
      stack.push({ matrix, unsupported, clips: [...clips] });
      if (args[0]) matrix = multiply(matrix, matrixSchema.parse(args[0]));
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
          clips.push([
            Math.max(...xs) - Math.min(...xs),
            0,
            0,
            Math.max(...ys) - Math.min(...ys),
            Math.min(...xs),
            Math.min(...ys),
          ]);
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
