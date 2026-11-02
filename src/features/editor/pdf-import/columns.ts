import type { Column } from "@/lib/page-bands";
import type { Region } from "./model";
import { contentSpan, snapImageWidth } from "./photo-size";

// Two-column PDF pages (aboard #23): a region that sits within one half of the
// page's content, on a page with narrow text on both halves, takes that side,
// so it imports as a Left or Right block and keeps the source's columns. A
// photo in a column also gets its size as a share of the column. Headings stay
// full width. A batch holding only one side imports full width (`unsided`).

/** Share of the content span past which a region spans the page. */
const NARROW = 0.6;
/** Slack across the middle, for a ragged gutter. */
const SLACK = 0.05;

export function markColumns(regions: Region[]): void {
  if (regions.length < 2) return;
  const left = Math.min(...regions.map((r) => r.x));
  const span = contentSpan(regions);
  const mid = left + span / 2;
  const sideOf = (r: Region): Column | null =>
    r.heading || r.width > span * NARROW
      ? null
      : r.x + r.width <= mid + span * SLACK
        ? "left"
        : r.x >= mid - span * SLACK
          ? "right"
          : null;
  const text = regions.filter((r) => r.kind === "text");
  const sides = new Set(text.map(sideOf));
  if (!sides.has("left") || !sides.has("right")) return;
  // A column is as wide as its widest region (the gutter isn't half the span).
  const width = (side: Column) =>
    Math.max(
      span / 2 - span * SLACK,
      ...regions.filter((r) => sideOf(r) === side).map((r) => r.width),
    );
  for (const region of regions) {
    const side = sideOf(region);
    if (!side) continue;
    region.side = side;
    if (region.image)
      region.image.columnShare = snapImageWidth(region.width / width(side));
  }
}
