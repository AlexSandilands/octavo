import "server-only";
import sharp from "sharp";

// Normalise an uploaded image to a web-ready WebP: honour EXIF orientation, cap
// the longest edge, strip metadata, re-encode. One format out keeps the reader
// fast and storage predictable (design-principles §8).

export const MAX_EDGE = 2000; // px — generous for a full-bleed magazine page
const WEBP_QUALITY = 82;
// Hard input ceiling well below sharp's ~268MP default: a byte-small but
// pixel-dense image can't balloon memory during decode. ~50MP covers any
// real camera photo.
const MAX_INPUT_PIXELS = 50_000_000;

// Formats we decode, checked against sharp's *content* detection — the
// client-supplied MIME type is not trusted. SVG is deliberately absent:
// rasterising attacker-supplied SVG (librsvg) is an SSRF/DoS surface.
const DECODABLE = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);

export class UnsupportedImageError extends Error {
  constructor(format: string | undefined) {
    super(`Unsupported image format: ${format ?? "unknown"}`);
    this.name = "UnsupportedImageError";
  }
}

export type ProcessedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
};

/**
 * Check bytes that are already stored-shaped — an imported bundle's WebP, which
 * is written through untouched rather than re-encoded. Returns the real format
 * and size, or null when it does not decode at all. The probe resizes to 8px so
 * the input is genuinely decoded (metadata alone reads only the header) without
 * holding a full-size bitmap per image.
 */
export async function inspectStoredImage(
  input: Buffer,
): Promise<{ format: string; width: number; height: number } | null> {
  try {
    const options = {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    } as const;
    const { format, width, height } = await sharp(input, options).metadata();
    if (!format || !width || !height) return null;
    await sharp(input, options).resize(8, 8, { fit: "fill" }).raw().toBuffer();
    return { format, width, height };
  } catch {
    return null;
  }
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  });

  const { format } = await pipeline.metadata();
  if (!format || !DECODABLE.has(format)) {
    throw new UnsupportedImageError(format);
  }

  const { data, info } = await pipeline
    .rotate() // bake in EXIF orientation, then drop the tag
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    contentType: "image/webp",
  };
}

export const AVATAR_EDGE = 256;

// The first bytes of every format DECODABLE accepts. A cheap look at the file
// itself before sharp sees it, so a PDF or a script never reaches the decoder.
export function looksLikeImage(input: Buffer): boolean {
  const at = (offset: number, text: string) =>
    input.subarray(offset, offset + text.length).toString("latin1") === text;
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return true;
  if (at(0, "\x89PNG\r\n\x1a\n")) return true;
  if (at(0, "GIF87a") || at(0, "GIF89a")) return true;
  if (at(0, "RIFF") && at(8, "WEBP")) return true;
  // AVIF/HEIF: an ISO box whose type is "ftyp", brand checked by sharp.
  return at(4, "ftyp");
}

// A member's avatar (issue #300): the same decode and limits as processImage,
// then a centre square crop at 256px.
export async function processAvatar(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const { format } = await pipeline.metadata();
  if (!format || !DECODABLE.has(format)) {
    throw new UnsupportedImageError(format);
  }
  const { data, info } = await pipeline
    .rotate()
    .resize(AVATAR_EDGE, AVATAR_EDGE, { fit: "cover", position: "centre" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    width: info.width,
    height: info.height,
    contentType: "image/webp",
  };
}
