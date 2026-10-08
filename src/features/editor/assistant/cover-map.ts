// A cover as the model needs to see it to lay one out: where each item
// actually sits once set (shares of the cover's grid, which is the page inside
// its margins), which of the nine cells nothing touches, and what overlaps
// what, by id. Without it the model only heard "Story overlaps logo" and
// moved things back and forth until the breaker stopped it.
import type { Block, Page } from "@/lib/blocks";
import type { CoverElement, CoverPlacement } from "@/lib/cover-elements";
import { coverItems, placementOf, type CoverItem } from "@/lib/cover-order";
import type { CoverWarning } from "../use-cover-layout-warnings";

/** An item's box as fractions (0–1) of the cover grid. */
export type CoverBox = {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type CoverLayout = { warnings: CoverWarning[]; boxes: CoverBox[] };

const COLUMNS = ["left", "center", "right"] as const;
const ROWS = ["top", "center", "bottom"] as const;
type Cell = { column: CoverPlacement["column"]; row: CoverPlacement["row"] };

/** Every placed item's box, read off a laid-out cover. */
export function readCoverBoxes(root: HTMLElement | null): CoverBox[] {
  const grid = root?.querySelector<HTMLElement>(".cover-grid");
  if (!grid) return [];
  const g = grid.getBoundingClientRect();
  if (!g.width || !g.height) return [];
  return [...grid.querySelectorAll<HTMLElement>("[data-cover-entry]")]
    .map((el) => ({
      id: el.dataset.coverEntry!,
      r: el.getBoundingClientRect(),
    }))
    .filter(({ r }) => r.width > 0 && r.height > 0)
    .map(({ id, r }) => ({
      id,
      x0: (r.left - g.left) / g.width,
      x1: (r.right - g.left) / g.width,
      y0: (r.top - g.top) / g.height,
      y1: (r.bottom - g.top) / g.height,
    }));
}

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) - Math.max(a0, b0);
const intersects = (a: Omit<CoverBox, "id">, b: Omit<CoverBox, "id">) =>
  overlap(a.x0, a.x1, b.x0, b.x1) > 0.005 &&
  overlap(a.y0, a.y1, b.y0, b.y1) > 0.005;

/** The cells no box reaches more than a sliver into. */
export function clearCells(boxes: Omit<CoverBox, "id">[]): Cell[] {
  const cells: Cell[] = [];
  ROWS.forEach((row, r) =>
    COLUMNS.forEach((column, c) => {
      const cell = { x0: c / 3, x1: (c + 1) / 3, y0: r / 3, y1: (r + 1) / 3 };
      const touched = boxes.some(
        (b) =>
          overlap(b.x0, b.x1, cell.x0, cell.x1) > 0.04 &&
          overlap(b.y0, b.y1, cell.y0, cell.y1) > 0.04,
      );
      if (!touched) cells.push({ column, row });
    }),
  );
  return cells;
}

const cellName = (c: Cell) => `${c.row} ${c.column}`;
const pct = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100);

function label(item: CoverItem): string {
  if (!("placement" in item))
    return item.type === "heading" ? "masthead" : item.type;
  if (item.type === "story") {
    const first = item.title || item.items[0]?.title;
    return first ? `story "${first.slice(0, 40)}"` : "story";
  }
  return item.type;
}

/** The measured map that ends every cover result; "" with nothing measured. */
export function coverMapText(page: Page, layout: CoverLayout): string {
  if (!layout.boxes.length) return "";
  const items = coverItems(page);
  const named = (id: string) => {
    const item = items.find((i) => i.id === id);
    return item ? `${label(item)} [${id}]` : `[${id}]`;
  };
  const lines = layout.boxes.map((b) => {
    const item = items.find((i) => i.id === b.id);
    const p = item && placementOf(item, page);
    const at = p ? ` (${p.row} ${p.column}, ${p.width})` : "";
    return `${named(b.id)}${at}: across ${pct(b.x0)}–${pct(b.x1)}%, down ${pct(b.y0)}–${pct(b.y1)}%`;
  });
  const clear = clearCells(layout.boxes).map(cellName);
  const overlaps = layout.warnings
    .filter((w) => w.ids.length === 2)
    .map((w) => `${named(w.ids[0]!)} and ${named(w.ids[1]!)}`);
  return [
    `Cover map (measured, as shares of the page inside its margins): ${lines.join("; ")}.`,
    `Clear cells: ${clear.length ? clear.join(", ") : "none"}.`,
    overlaps.length ? `Overlapping: ${overlaps.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Where a new item may go, best first, by kind. */
const PREFERRED: Record<string, Cell[]> = {
  details: [
    { row: "top", column: "right" },
    { row: "bottom", column: "right" },
    { row: "bottom", column: "left" },
    { row: "bottom", column: "center" },
    { row: "top", column: "center" },
  ],
  logo: [
    { row: "bottom", column: "right" },
    { row: "top", column: "right" },
    { row: "bottom", column: "left" },
    { row: "bottom", column: "center" },
  ],
  story: [
    { row: "center", column: "left" },
    { row: "bottom", column: "left" },
    { row: "center", column: "right" },
    { row: "bottom", column: "right" },
    { row: "bottom", column: "center" },
  ],
};

/**
 * A clear cell for a just-added item, sized as it measured where it landed,
 * that no other item would touch; null if its spot is already clear or
 * nothing fits. Only cells no other item is placed in: a stack's height moves.
 */
export function clearSpotFor(
  page: Page,
  id: string,
  layout: CoverLayout,
): Cell | null {
  const items = coverItems(page);
  const item = items.find((i) => i.id === id);
  const box = layout.boxes.find((b) => b.id === id);
  if (!item || !box || !("placement" in item)) return null;
  const others = layout.boxes.filter((b) => b.id !== id);
  if (!others.some((b) => intersects(b, box))) return null;
  const taken = new Set(
    items.filter((i) => i.id !== id).map((i) => cellName(placementOf(i, page))),
  );
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const at = (c: Cell) => {
    const x0 =
      c.column === "left" ? 0 : c.column === "right" ? 1 - w : (1 - w) / 2;
    const y0 = c.row === "top" ? 0 : c.row === "bottom" ? 1 - h : (1 - h) / 2;
    return { x0, x1: x0 + w, y0, y1: y0 + h };
  };
  return (
    (PREFERRED[item.type] ?? []).find(
      (c) =>
        !taken.has(cellName(c)) && !others.some((b) => intersects(b, at(c))),
    ) ?? null
  );
}

/** An element moved to `cell`, its text set to the cell's side. */
export function moveElement(
  page: Page,
  id: string,
  cell: Pick<CoverPlacement, "row" | "column">,
): Page {
  return {
    ...page,
    coverElements: (page.coverElements ?? []).map((e) =>
      e.id === id
        ? { ...e, placement: { ...e.placement, ...cell, align: cell.column } }
        : e,
    ),
  };
}

const isBackground = (b: Block) =>
  b.type === "image" && (b.align === "page-fill" || b.align === "page-fit");

/** "a background photo, a masthead, 2 stories, issue details and a logo". */
export function coverSummary(page: Page): string {
  const els = page.coverElements ?? [];
  const n = (type: CoverElement["type"]) =>
    els.filter((e) => e.type === type).length;
  const stories = n("story");
  const logos = n("logo");
  const parts = [
    page.blocks.some(isBackground) && "a background photo",
    page.blocks.some((b) => b.type === "heading") && "a masthead",
    stories && `${stories} stor${stories > 1 ? "ies" : "y"}`,
    n("details") && "issue details",
    logos && `${logos} logo${logos > 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "nothing on it";
}
