import { IMAGE_SIZES } from "@/lib/blocks";
import type { Box } from "./model";

/** A page's content, as a lone photo sees it: the page less an inch-ish margin each side. */
export const LONE_PHOTO_MARGIN = 0.12;

/**
 * The editor size (percent of the text column) nearest a photo's share of its
 * page's content: the horizontal span of every region on the page, text and
 * photos, so page margins don't shrink every photo. A photo that is the page's
 * only region is measured against the page width less typical margins instead.
 */
export function photoWidth(photo: Box, regions: Box[], pageWidth: number) {
  const span =
    regions.length > 1
      ? contentSpan([photo, ...regions])
      : pageWidth * (1 - 2 * LONE_PHOTO_MARGIN);
  return snapImageWidth(photo.width / Math.max(span, 1));
}

export function contentSpan(regions: Box[]) {
  const left = Math.min(...regions.map((r) => r.x));
  const right = Math.max(...regions.map((r) => r.x + r.width));
  return right - left;
}

/** The nearest of S / M / L / Full to a share of the column (0–1, clamped). */
export function snapImageWidth(share: number) {
  const percent = Math.min(1, Math.max(0, share)) * 100;
  return IMAGE_SIZES.reduce((best, s) =>
    Math.abs(s.value - percent) < Math.abs(best.value - percent) ? s : best,
  ).value;
}
