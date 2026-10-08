// The cover map the cover tools end with, and the clear spot a just-added item
// moves to (cover-map.ts), on laid-out boxes given by hand. In memory.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-cover-map.mts
import { makeBlock, type Block, type Page } from "../src/lib/blocks.ts";
import { makeCoverElement } from "../src/lib/cover-elements.ts";
import {
  clearCells,
  clearSpotFor,
  coverMapText,
  moveElement,
  type CoverBox,
} from "../src/features/editor/assistant/cover-map.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};

const masthead = {
  ...makeBlock("heading"),
  title: "Regatta",
  coverPlacement: {
    ...makeCoverElement("details").placement,
    row: "top",
    column: "left",
    width: "wide",
  },
} as Block;
const story = makeCoverElement("story");
const details = makeCoverElement("details");
const page = {
  ...makeBlock("heading"),
  id: "cover",
  cover: true,
  blocks: [masthead],
  coverElements: [
    {
      ...story,
      placement: { ...story.placement, row: "bottom", width: "medium" },
    },
    {
      ...details,
      placement: { ...details.placement, column: "right", align: "right" },
    },
  ],
} as unknown as Page;

// A wide masthead across the top, a medium story bottom left, and details
// top right, below the masthead's line (no overlap).
const boxes: CoverBox[] = [
  { id: masthead.id, x0: 0, x1: 1, y0: 0, y1: 0.18 },
  { id: story.id, x0: 0, x1: 0.47, y0: 0.7, y1: 1 },
  { id: details.id, x0: 0.53, x1: 1, y0: 0.2, y1: 0.26 },
];
const warnings = [
  { ids: [masthead.id, details.id], text: "Heading overlaps details." },
];
const cells = clearCells(boxes).map((c) => `${c.row} ${c.column}`);
ok(
  !cells.some((c) => c.startsWith("top")) &&
    cells.includes("bottom right") &&
    !cells.includes("bottom left"),
  `a wide item takes its whole row; clear cells follow the boxes (${cells.join(", ")})`,
);

// Details added top right, under the wide masthead's reach.
const overlapping = [
  ...boxes.slice(0, 2),
  { id: details.id, x0: 0.53, x1: 1, y0: 0.05, y1: 0.12 },
];
const spot = clearSpotFor(page, details.id, {
  warnings,
  boxes: overlapping,
});
ok(
  spot?.row === "bottom" && spot.column === "right",
  `details under a wide masthead go to the first clear spot for details: the masthead reaches over top right, so bottom right (${spot?.row} ${spot?.column})`,
);
ok(
  clearSpotFor(page, details.id, { warnings: [], boxes }) === null,
  "an item that touches nothing stays where it landed",
);
const moved = moveElement(page, details.id, spot!);
const placed = moved.coverElements!.find((e) => e.id === details.id)!;
ok(
  placed.placement.row === "bottom" &&
    placed.placement.column === "right" &&
    placed.placement.align === "right",
  "a moved item takes the cell and sets its text to that side",
);

const map = coverMapText(page, { warnings, boxes: overlapping });
ok(
  map.includes(`masthead [${masthead.id}] (top left, wide): across 0–100%`) &&
    map.includes("Clear cells: ") &&
    map.includes(
      `Overlapping: masthead [${masthead.id}] and details [${details.id}]`,
    ),
  `the map names each item, where it sits, the clear cells and the overlap (${map})`,
);
ok(
  coverMapText(page, { warnings: [], boxes: [] }) === "",
  "with nothing measured there is no map",
);

console.log("\nPASS — the cover map and clear spots");
