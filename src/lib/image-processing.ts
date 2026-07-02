import "server-only";
import sharp from "sharp";

// Normalise an uploaded image to a web-ready WebP: honour EXIF orientation, cap
// the longest edge, strip metadata, re-encode. One format out keeps the reader
// fast and storage predictable (design-principles §8).

const MAX_EDGE = 2000; // px — generous for a full-bleed magazine page
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
