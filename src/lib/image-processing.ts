import "server-only";
import sharp from "sharp";

// Normalise an uploaded image to a web-ready WebP: honour EXIF orientation, cap
// the longest edge, strip metadata, re-encode. One format out keeps the reader
// fast and storage predictable (design-principles §8).

const MAX_EDGE = 2000; // px — generous for a full-bleed magazine page
const WEBP_QUALITY = 82;

export type ProcessedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { failOn: "error" })
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
