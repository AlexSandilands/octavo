import { paragraph, union } from "./grouping";
import type { Region, Run } from "./model";

// Over-grouping is the detector's most common mistake: two paragraphs with a
// tight gap read as one region. A split cuts at the widest gap between the
// region's own source lines, so both halves keep real page geometry.
export function splitRegion(region: Region): [Region, Region] | null {
  const lines = region.lines;
  if (region.kind !== "text" || !lines || lines.length < 2) return null;
  let at = Math.ceil(lines.length / 2);
  let widest = -Infinity;
  for (let i = 1; i < lines.length; i++) {
    const above = union(lines[i - 1]!);
    const below = union(lines[i]!);
    const gap = below.y - above.y - above.height;
    if (gap > widest + 0.5) {
      widest = gap;
      at = i;
    }
  }
  const half = (part: Run[][], suffix: string, order: number): Region => ({
    ...region,
    ...union(part.flat()),
    id: `${region.id}${suffix}`,
    order,
    doc: { type: "doc", content: [paragraph(part)] },
    lines: part,
  });
  return [
    half(lines.slice(0, at), ".1", region.order),
    half(lines.slice(at), ".2", region.order + 0.5),
  ];
}

/** The page's regions with `id` split in place and orders renumbered. */
export function splitPageRegions(regions: Region[], id: string): Region[] {
  const target = regions.find((r) => r.id === id);
  const halves = target && splitRegion(target);
  if (!halves) return regions;
  return regions
    .flatMap((r) => (r.id === id ? halves : [r]))
    .sort((a, b) => a.order - b.order)
    .map((r, order) => ({ ...r, order }));
}
