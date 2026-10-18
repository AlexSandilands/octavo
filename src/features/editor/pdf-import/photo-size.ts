import { IMAGE_SIZES } from "@/lib/blocks";
import type { Box } from "./model";

// The least share of the page that counts as its content, so a photo with only a caption
// or page number beside it isn't measured against itself.
const MIN_CONTENT_SHARE = 0.6;

export function photoWidth(photo: Box, regions: Box[], pageWidth: number) {
  const span = Math.max(
    contentSpan([photo, ...regions]),
    pageWidth * MIN_CONTENT_SHARE,
  );
  return snapImageWidth(photo.width / Math.max(span, 1));
}

export function contentSpan(regions: Box[]) {
  const left = Math.min(...regions.map((r) => r.x));
  const right = Math.max(...regions.map((r) => r.x + r.width));
  return right - left;
}

/** The largest of S / M / L / Full within a share of the column (0–1); never below S. */
export function snapImageWidth(share: number) {
  const percent = share * 100 + 1e-6;
  return IMAGE_SIZES.reduce(
    (best, s) => (s.value <= percent ? s.value : best),
    IMAGE_SIZES[0]!.value,
  );
}
