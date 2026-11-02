// Two-column text (content v12, aboard #23), in memory: the `column` field
// through the save schema and the transfer document, the band rule (and that a
// lone floated photo is untouched), reading order, the editor's moves, the
// split's landing, the assistant's tools and view, PDF column detection and the
// import paginator's column flow. No database, no spend.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-text-columns.mts
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
} from "../src/lib/blocks";
import { AI_TOOL_NAMES, aiToolSchemas } from "../src/lib/ai-tools";
import { checkBundledIssue } from "../src/lib/issue-transfer/document";
import {
  bandColumnOf,
  pageSegments,
  readingOrder,
  textColumn,
} from "../src/lib/page-bands";
import {
  dragBlocks,
  dropInColumn,
  stepBlock,
} from "../src/features/editor/move-block";
import { flowTextBlock, planFlow } from "../src/features/editor/text-flow";
import { pageView } from "../src/features/editor/assistant/projection";
import { markColumns } from "../src/features/editor/pdf-import/columns";
import {
  reviewItem,
  synthesize,
} from "../src/features/editor/pdf-import/synthesis";
import { paginateImport } from "../src/features/editor/pdf-import/paginate";
import type { Region } from "../src/features/editor/pdf-import/model";
import { readerSections } from "../src/features/reader/mobile-sections";
import * as h from "./fixtures/assistant/tools-harness.mts";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const { ok, heading, harness, cover, page, textBlock, headingBlock, photo } = h;
type TextBlock = Extract<Block, { type: "text" }>;
const col = (b: Block, column: "left" | "right") =>
  ({ ...(b as TextBlock), column }) as Block;
const ids = (blocks: Block[]) => blocks.map((b) => b.id).join();

heading("the content model");
ok(CONTENT_VERSION === 12, "content version 12");
{
  const left = col(textBlock(1), "left");
  const content = { version: 12, pages: [page(left)] };
  const parsed = issueContentSchema.parse(JSON.parse(JSON.stringify(content)));
  ok(
    (parsed.pages[0]!.blocks[0] as TextBlock).column === "left",
    "the save path keeps a column",
  );
  ok(
    !issueContentSchema.safeParse({
      pages: [page({ ...left, column: "middle" } as unknown as Block)],
    }).success,
    "an unknown column is refused",
  );
  const bundled = checkBundledIssue(
    {
      title: "T",
      theme: "classic",
      content,
      footerMarkSize: 0,
      footerTextSize: 0,
      logoId: null,
      number: null,
      status: "draft",
      publishedAt: null,
    },
    "T",
  );
  ok(
    bundled.ok && JSON.stringify(bundled.issue.content).includes('"left"'),
    "an imported bundle keeps a column",
  );
}

heading("the band rule");
{
  const H = headingBlock("Head");
  const L1 = col(textBlock(1, "L1"), "left");
  const L2 = col(textBlock(1, "L2"), "left");
  const R1 = col(textBlock(1, "R1"), "right");
  const pic = photo(50, "left");
  const segs = pageSegments([H, L1, R1, pic, L2]);
  ok(
    segs.length === 2 && segs[0]!.kind === "block" && segs[1]!.kind === "band",
    "a heading spans the page above one band",
  );
  const band = segs[1] as Extract<(typeof segs)[number], { kind: "band" }>;
  ok(
    ids(band.left) === ids([L1, pic, L2]) && ids(band.right) === ids([R1]),
    "left blocks stack down the left column in order, right down the right",
  );
  ok(
    ids(readingOrder([H, L1, R1, pic, L2])) === ids([H, L1, pic, L2, R1]),
    "reading order: the heading, the left column, then the right",
  );
  const float = photo(45, "left");
  const full = textBlock(2);
  ok(
    pageSegments([float, full]).every((s) => s.kind === "block"),
    "a floated photo beside full-width text forms no band (old issues unchanged)",
  );
  ok(
    pageSegments([L1, H, R1]).filter((s) => s.kind === "band").length === 2,
    "a full-width block ends a band",
  );
  ok(bandColumnOf([L1, pic], pic.id) === "left", "a side photo joins its band");
  const sections = readerSections([cover, page(H, L1, R1, L2)]);
  ok(
    ids(sections.at(-1)!.blocks) === ids([H, L1, L2, R1]),
    "the phone reader reads a band left column, then right",
  );
}

heading("moves");
{
  const H = headingBlock("Head");
  const L1 = col(textBlock(1, "L1"), "left");
  const L2 = col(textBlock(1, "L2"), "left");
  const R1 = col(textBlock(1, "R1"), "right");
  const F = textBlock(1, "F");
  const blocks = [H, L1, R1, L2, F];
  const down = stepBlock(blocks, L1.id, 1);
  ok(
    Array.isArray(down) && ids(down) === ids([H, L2, R1, L1, F]),
    "down steps within the column, past the other column's blocks",
  );
  const out = stepBlock(blocks, L2.id, 1);
  ok(
    Array.isArray(out) && ids(out) === ids([H, L1, R1, F, L2]),
    "off a column's foot it steps over the block beyond the band",
  );
  const up = stepBlock(blocks, F.id, -1);
  ok(
    Array.isArray(up) && ids(up) === ids([H, F, L1, R1, L2]),
    "a full-width block steps over a whole band",
  );
  ok(stepBlock([L1, R1], R1.id, 1) === "across", "the page's edge leaves");
  const dropped = dropInColumn(blocks, L2.id, R1.id);
  ok(
    textColumn(dropped.find((b) => b.id === L2.id)!) === "right",
    "a drag onto the other column switches side",
  );
  // A drag (pointer or keyboard) walks reading order: left column, then right.
  const notices = [H, L1, R1, L2];
  const within = dragBlocks(notices, L1.id, L2.id)!;
  ok(
    ids(readingOrder(within)) === ids([H, L2, L1, R1]) &&
      textColumn(within.find((b) => b.id === L1.id)!) === "left",
    "a keyboard step down within a column stays in it",
  );
  const across = dragBlocks(notices, L2.id, R1.id)!;
  ok(
    textColumn(across.find((b) => b.id === L2.id)!) === "right" &&
      ids(readingOrder(across)) === ids([H, L1, R1, L2]),
    "a step down off the left column's foot is the next place in reading order",
  );
  ok(dragBlocks(notices, L1.id, L1.id) === null, "a drop on itself is no edit");
}

heading("the split's landing");
{
  const nodes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ top: i * 40, bottom: i * 40 + 40 }));
  const metrics = {
    nodes: nodes(10),
    firstAvail: 120,
    restAvail: 160,
    rightAvail: 200,
  };
  const plan = planFlow(metrics, true);
  ok(
    plan.landing.right && plan.cuts.join() === "3,8",
    "left (3 fit) → right column (5 fit) → next page",
  );
  ok(
    !planFlow({ ...metrics, rightAvail: 10 }, true).landing.right,
    "a right column with no room for one node is skipped",
  );
  const H = headingBlock("Head");
  const L = col(textBlock(12, "P"), "left");
  const R = col(textBlock(1, "R"), "right");
  const pages = [cover, page(H, L, R)];
  const next = flowTextBlock(pages, 1, L.id, [3, 6, 9], {
    right: true,
    columns: true,
  })!;
  const p1 = next[1]!.blocks;
  ok(
    p1.length === 4 &&
      textColumn(p1[2]!) === "right" &&
      p1[3]!.id === R.id &&
      bandColumnOf(p1, p1[2]!.id) === "right",
    "the first continuation tops the right column, above what was there",
  );
  const p2 = next[2]!.blocks;
  ok(
    next.length === 3 && p2.map((b) => textColumn(b)).join() === "left,right",
    "the next page takes a left and a right continuation",
  );
  const full = textBlock(6);
  const flat = flowTextBlock([cover, page(full)], 1, full.id, [2, 4])!;
  ok(
    flat.length === 4 && flat.slice(2).every((p) => !textColumn(p.blocks[0]!)),
    "full-width text still flows one chunk per page",
  );
}

heading("the assistant");
ok(AI_TOOL_NAMES.at(-1) === "set_text_layout", "set_text_layout is last");
ok(
  !aiToolSchemas.set_text_layout.safeParse({ blockId: "a", column: "mid" })
    .success,
  "a column is one of full, left, right",
);
{
  const H = headingBlock("Notices");
  const body = textBlock(2);
  const ed = harness([cover, page(H, body)]);
  let out = await ed.run("set_text_layout", {
    blockId: body.id,
    column: "left",
  });
  ok(
    (ed.pages[1]!.blocks[1] as TextBlock).column === "left",
    `set_text_layout sets a column (${out.text.split("\n")[0]})`,
  );
  out = await ed.run("insert_blocks", {
    after: { blockId: body.id },
    blocks: [{ kind: "text", markdown: "Right side.", column: "right" }],
  });
  ok(
    textColumn(ed.pages[1]!.blocks[2]!) === "right",
    "insert_blocks places text in a column",
  );
  out = await ed.run("set_text_layout", { blockId: body.id, column: "full" });
  ok(textColumn(ed.pages[1]!.blocks[1]!) === null, "full clears the column");
  out = await ed.run("set_text_layout", { blockId: H.id, column: "left" });
  ok(out.text.includes("not text"), "a heading is refused");
  const longL = col(textBlock(30, "Long"), "left");
  const split = harness([cover, page(headingBlock("Feature"), longL)]);
  out = await split.run("split_page", { page: 2 });
  const after = split.pages.slice(1).flatMap((p) => p.blocks);
  ok(
    out.text.startsWith("Flowed the column's text") &&
      after.filter((b) => b.type === "text").every((b) => textColumn(b)),
    "split_page flows a column block in columns",
  );
}

heading("the page view");
{
  const L = col(textBlock(1), "left");
  const pic = photo(50, "right");
  const view = pageView(
    {
      title: "T",
      theme: "classic",
      pages: [cover, page(L, pic)],
      fills: {},
      images: {},
      uploads: [],
      logos: [],
      sponsorNames: [],
    } as never,
    2,
  );
  ok(
    view.includes("text · left column") && view.includes("in the right column"),
    "read_page marks a column block and a photo in a band",
  );
}

heading("PDF import");
{
  const region = (
    id: string,
    x: number,
    y: number,
    width: number,
    kind: "text" | "image" = "text",
    heading = false,
  ): Region =>
    ({
      id,
      page: 1,
      order: 0,
      x,
      y,
      width,
      height: 40,
      kind,
      heading,
      level: "main",
      size: "m",
      align: "left",
      doc: { type: "doc", content: [h.para(id)] },
      ...(kind === "image"
        ? { image: { blob: null, width: 10, height: 10, key: id } }
        : {}),
    }) as unknown as Region;
  const regions = [
    region("head", 50, 20, 500, "text", true),
    region("l1", 50, 80, 240),
    region("pic", 50, 140, 240, "image"),
    region("r1", 310, 80, 240),
  ];
  markColumns(regions);
  ok(
    regions.map((r) => r.side ?? "-").join() === "-,left,left,right",
    "a two-column page's regions take their sides; the heading spans",
  );
  ok(
    regions[2]!.image!.columnShare === 100,
    "a column-wide photo is Full of its column",
  );
  const single = [region("a", 50, 80, 500), region("b", 50, 140, 200)];
  markColumns(single);
  ok(
    single.every((r) => !r.side),
    "a single-column page with a short paragraph keeps full width",
  );
  const block = reviewItem(regions[1]!).block as TextBlock;
  ok(block.column === "left", "a left region imports as a Left block");
  const one = synthesize([reviewItem(regions[3]!)]).blocks;
  ok(
    one.length === 1 && textColumn(one[0]!) === null,
    "one side alone imports full width, not a one-sided band",
  );
  const photoAlone = (choice?: { width: number }) =>
    synthesize([reviewItem(regions[2]!, choice)]).blocks[0] as {
      align: string;
      width: number;
    };
  ok(
    photoAlone().align === "full" &&
      photoAlone({ width: 100 }).width === 100 &&
      photoAlone({ width: 33 }).width === 33,
    "a lone column photo imports full width, keeping a size the author picked",
  );
  const both = synthesize(regions.slice(1).map((r) => reviewItem(r))).blocks;
  ok(
    both.map((b) => bandColumnOf(both, b.id)).join() === "left,left,right",
    "both sides import as a band",
  );
  ok(
    reviewItem(regions[2]!).block.type === "image" &&
      (reviewItem(regions[2]!).block as { align: string }).align === "left",
    "a photo in a column imports into that column",
  );

  // Fits: each column stacks 40px a node; a band is as tall as its taller column.
  const AVAIL = 400;
  const heightOf = (b: Block) =>
    b.type === "text" ? h.docOf(b as TextBlock).content.length * 40 : 60;
  const fits = async (blocks: Block[]) => {
    let y = 0;
    for (const s of pageSegments(blocks))
      y +=
        s.kind === "block"
          ? heightOf(s.block)
          : Math.max(
              s.left.reduce((a, b) => a + heightOf(b), 0),
              s.right.reduce((a, b) => a + heightOf(b), 0),
            );
    return y <= AVAIL;
  };
  const L = col(textBlock(25, "P"), "left");
  const result = await paginateImport({
    pages: [cover, page()],
    index: 1,
    selected: null,
    inserted: [headingBlock("Feature"), L],
    fits,
    signal: new AbortController().signal,
  });
  const first = result.pages[1]!.blocks;
  ok(
    first.some((b) => textColumn(b) === "left") &&
      first.some((b) => textColumn(b) === "right"),
    "an overflowing left column carries on at the top of the right one",
  );
  ok(
    textColumn(result.pages[2]!.blocks[0]!) === "left",
    "then onto the next page's left column",
  );
}

heading("the seed authors the new shape");
{
  const seeded = JSON.stringify(
    buildIssues(
      Object.fromEntries(SEED_IMAGES.map((s) => [s.key, s.key])) as SeedImages,
    ),
  );
  ok(
    seeded.includes('"column":"left"') && seeded.includes('"column":"right"'),
    "a seed page sets text in two columns",
  );
}

console.log(h.failures ? `\n${h.failures} failed` : "\nall passed");
process.exit(h.failures ? 1 : 0);
