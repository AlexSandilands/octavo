import type { Paragraph, RichInline } from "@/lib/rich-text-doc";
import {
  PDF_LIMITS,
  yieldTask,
  checkAbort,
  type Box,
  type Region,
  type Run,
} from "./model";

export function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}
function paragraph(lines: Run[][]): Paragraph {
  const content: RichInline[] = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const [index, run] of line.entries()) {
      const prev = line[index - 1];
      const previous = content.at(-1);
      const wrappingSoftHyphen =
        index === 0 &&
        lineIndex > 0 &&
        lines[lineIndex - 1]?.at(-1)?.text.endsWith("\u00ad");
      const gap =
        index === 0
          ? lineIndex > 0
          : prev && run.x - prev.x - prev.width > run.size * 0.15;
      const space =
        gap &&
        !wrappingSoftHyphen &&
        !/^\s/u.test(run.text) &&
        !(previous?.type === "text" && /\s$/u.test(previous.text));
      if (space && content.length) content.push({ type: "text", text: " " });
      // Only a soft hyphen is unambiguous; ordinary hyphens stay reviewable.
      const text = run.text.replace(/\u00ad$/u, "");
      if (text)
        content.push({
          type: "text",
          text,
          ...(run.marks.length ? { marks: run.marks } : {}),
        });
    }
  }
  return { type: "paragraph", content };
}

/** Split wide gutters before ordering vertically, so columns never interleave. */
export async function groupRuns(
  runs: Run[],
  page: number,
  pageWidth: number,
  signal: AbortSignal,
): Promise<Region[]> {
  if (runs.length > PDF_LIMITS.runs)
    throw new Error("This page has too many text fragments. Try another page.");
  const weights = new Map<number, number>();
  for (const run of runs)
    weights.set(run.size, (weights.get(run.size) ?? 0) + run.text.length);
  const median = [...weights.entries()].sort((a, b) => a[0] - b[0]);
  const total = median.reduce((n, [, weight]) => n + weight, 0);
  let cumulative = 0,
    body = 12;
  for (const [size, weight] of median) {
    cumulative += weight;
    if (cumulative >= total / 2) {
      body = size;
      break;
    }
  }
  const lines: Run[][] = [];
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const [index, run] of sorted.entries()) {
    if (index % 200 === 0) {
      checkAbort(signal);
      await yieldTask();
    }
    const line = lines
      .slice(-6)
      .find(
        (l) =>
          Math.abs(l[0]!.y - run.y) < Math.min(l[0]!.size, run.size) * 0.35 &&
          Math.abs(l[0]!.size - run.size) < body * 0.25,
      );
    if (line) line.push(run);
    else lines.push([run]);
  }
  const fragments: Run[][] = [];
  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex % 200 === 0) {
      checkAbort(signal);
      await yieldTask();
    }
    line.sort((a, b) => a.x - b.x);
    let part: Run[] = [];
    for (const run of line) {
      const prev = part.at(-1);
      if (prev && run.x - prev.x - prev.width > body * 2.4) {
        fragments.push(part);
        part = [];
      }
      part.push(run);
    }
    if (part.length) fragments.push(part);
  }
  const groups: Run[][][] = [];
  for (const [lineIndex, line] of fragments.entries()) {
    if (lineIndex % 200 === 0) {
      checkAbort(signal);
      await yieldTask();
    }
    const box = union(line);
    const size = line[0]!.size;
    const group = groups.slice(-12).find((g) => {
      const last = union(g.at(-1)!);
      return (
        box.y >= last.y &&
        box.y - last.y - last.height < size * 0.75 &&
        (Math.abs(box.x - last.x) < size ||
          Math.abs(box.x + box.width - last.x - last.width) < size ||
          Math.abs(box.x + box.width / 2 - last.x - last.width / 2) <
            size * 0.6) &&
        Math.abs(g[0]![0]!.size - size) < body * 0.15
      );
    });
    if (group) group.push(line);
    else groups.push([line]);
  }
  const regions: Region[] = [];
  for (const [index, group] of groups.entries()) {
    if (index % 100 === 0) {
      checkAbort(signal);
      await yieldTask();
    }
    const box = union(group.flat());
    const size = group[0]![0]!.size;
    const text = group
      .flat()
      .map((r) => r.text)
      .join(" ");
    const bold = group
      .flat()
      .some((r) => r.marks.some((m) => m.type === "bold"));
    const heading =
      text.length < 200 &&
      group.length <= 3 &&
      ((size > body * 1.25 && text.split(/\s+/u).length > 1) ||
        (bold && size >= body && group.length === 1) ||
        group.flat().some((r) => r.taggedHeading));
    const centers = group.map((l) => {
      const b = union(l);
      return b.x + b.width / 2;
    });
    const rights = group.map((l) => {
      const b = union(l);
      return b.x + b.width;
    });
    const lefts = group.map((line) => union(line).x);
    const range = (values: number[]) =>
      Math.max(...values) - Math.min(...values);
    const centered =
      group.length > 1 && range(centers) < size * 0.5 && range(lefts) > size;
    const right =
      group.length > 1 && range(rights) < size * 0.4 && range(lefts) > size;
    const justify =
      group.length >= 4 &&
      range(lefts) < size * 0.4 &&
      range(rights.slice(0, -1)) < size * 0.4 &&
      rights.at(-1)! < Math.max(...rights) - size * 2 &&
      box.width > size * 20;
    regions.push({
      ...box,
      id: `${page}:t:${index}`,
      page,
      order: 0,
      kind: "text",
      doc: { type: "doc", content: [paragraph(group)] },
      heading,
      level:
        size > body * 1.7
          ? "main"
          : size > body * 1.25
            ? "section"
            : "paragraph",
      size:
        size < body * 0.85
          ? "s"
          : size > body * 1.6
            ? "xl"
            : size > body * 1.15
              ? "l"
              : "m",
      align: centered
        ? "center"
        : right
          ? "right"
          : justify
            ? "justify"
            : "left",
    });
  }
  // Full-width headings partition the page into bands; within a band read left then right.
  const spans = regions
    .filter((r) => r.heading && r.width > pageWidth * 0.55)
    .sort((a, b) => a.y - b.y);
  const bands = new Map<string, number>();
  for (const region of regions) {
    let lo = 0,
      hi = spans.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (spans[mid]!.y < region.y) lo = mid + 1;
      else hi = mid;
    }
    bands.set(region.id, lo);
  }
  const band = (region: Region) => bands.get(region.id) ?? 0;
  regions.sort(
    (a, b) =>
      band(a) - band(b) ||
      (a.width > pageWidth * 0.55 || b.width > pageWidth * 0.55
        ? a.y - b.y
        : Math.abs(a.x - b.x) > pageWidth * 0.25
          ? a.x - b.x
          : a.y - b.y),
  );
  return regions.map((r, order) => ({ ...r, order }));
}
