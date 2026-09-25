// The assistant's editing tools (#310), in memory: every tool's zod and the
// executor's refusals, markdown round trips over the seed's text, one history
// step per run with undo back to the exact pages, the photo layout defaults,
// split_page, the overflow feedback, whole-issue validation, the
// circuit-breaker and the run summary. The measurer is a stand-in with fixed
// block heights (fixtures/assistant/tools-harness.mts); the real one is the
// editor's (dev-assistant-tools-gate.mts).
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-tools.mts
import { collectImageIds } from "../src/lib/images";
import type { Block } from "../src/lib/blocks";
import { aiToolSchemas, AI_TOOL_NAMES } from "../src/lib/ai-tools";
import { docToMarkdown, markdownToDoc } from "../src/lib/markdown-doc";
import { richDocSchema, richTextToPlain } from "../src/lib/rich-text-doc";
import { richDocBlocks } from "../src/lib/rich-text-split";
import type { EditorSnapshot } from "../src/features/editor/use-editor-history";
import {
  BREAKER_MESSAGE,
  createAssistantExecutor,
  formatPages,
} from "../src/features/editor/assistant/executor";
import type { EditMeasurer } from "../src/features/editor/assistant/page-report";
import * as h from "./fixtures/assistant/tools-harness.mts";

const { ok, heading, docOf, measurer, issues, photos, call, harness } = h;
const { textBlock, headingBlock, photo, cover, page } = h;

heading("the tool contract");
ok(
  AI_TOOL_NAMES.join() ===
    "read_page,set_text,set_heading,insert_blocks,delete_block,move_block,add_page,split_page,set_image_text,set_image_layout",
  "every tool is declared, read_page first (the cached order)",
);
const refused = (tool: keyof typeof aiToolSchemas, input: unknown) =>
  !aiToolSchemas[tool].safeParse(input).success;
for (const [tool, input, why] of [
  ["read_page", { page: 0 }, "page 0"],
  ["set_text", { blockId: "", markdown: "x" }, "an empty id"],
  ["set_heading", { blockId: "a", title: "T", level: "huge" }, "a level"],
  ["insert_blocks", { after: { page: 2 }, blocks: [] }, "no blocks"],
  [
    "insert_blocks",
    { after: { page: 2 }, blocks: [{ kind: "video" }] },
    "a kind",
  ],
  [
    "insert_blocks",
    { after: { block: "a" }, blocks: [{ kind: "text", markdown: "x" }] },
    "an anchor",
  ],
  ["delete_block", { blockId: "a", extra: 1 }, "an extra field"],
  ["move_block", { blockId: "a", after: { page: 1.5 } }, "a fractional page"],
  ["add_page", { after: 201 }, "past 200 pages"],
  ["split_page", {}, "no page"],
  [
    "set_image_text",
    { blockId: "a", alt: "x".repeat(301) },
    "a 301-character alt",
  ],
  ["set_image_layout", { blockId: "a", align: "center" }, "an align"],
  [
    "set_image_layout",
    { blockId: "a", align: "left", width: 10 },
    "a width under 20",
  ],
] as const)
  ok(refused(tool, input), `${tool}'s zod refuses ${why}`);

heading("unknown ids and places are refused, nothing changes");
{
  const h = harness([cover, page(textBlock(3), photo())]);
  const before = JSON.stringify(h.pages);
  for (const [tool, input, want] of [
    ["set_text", { blockId: "nope", markdown: "x" }, 'no block has id "nope"'],
    [
      "set_heading",
      { blockId: "nope", title: "T", level: "main" },
      "no block has id",
    ],
    ["delete_block", { blockId: "nope" }, "no block has id"],
    ["move_block", { blockId: "nope", after: { page: 2 } }, "no block has id"],
    ["set_image_text", { blockId: "nope", alt: "x" }, "no block has id"],
    ["set_image_layout", { blockId: "nope", align: "full" }, "no block has id"],
    [
      "insert_blocks",
      { after: { blockId: "nope" }, blocks: [{ kind: "text", markdown: "x" }] },
      "no block has id",
    ],
    [
      "insert_blocks",
      { after: { page: 2 }, blocks: [{ kind: "image", imageId: "img-leeks" }] },
      "isn't a photo uploaded",
    ],
    [
      "insert_blocks",
      { after: { page: 9 }, blocks: [{ kind: "text", markdown: "x" }] },
      "there is no page 9",
    ],
    [
      "insert_blocks",
      { after: { page: 1 }, blocks: [{ kind: "text", markdown: "x" }] },
      "is the cover",
    ],
    ["add_page", { after: 9 }, "there is no page 9"],
    ["split_page", { page: 9 }, "there is no page 9"],
    ["split_page", { page: 2 }, "already fits"],
    [
      "set_image_text",
      { blockId: h.pages[1]!.blocks[1]!.id },
      "give alt, caption or both",
    ],
    [
      "set_heading",
      { blockId: h.pages[1]!.blocks[0]!.id, title: "T", level: "main" },
      "is a text, not a heading",
    ],
    ["no_such_tool", {}, 'there is no tool "no_such_tool"'],
    [
      "set_heading",
      { blockId: "a", title: "T", level: "huge" },
      "invalid arguments for set_heading",
    ],
  ] as const) {
    const out = await h.run(tool, input);
    ok(
      out.text.startsWith("Error:") && out.text.includes(want),
      `${tool}: ${out.text}`,
    );
  }
  ok(JSON.stringify(h.pages) === before, "the pages are untouched");
  ok(h.history.length === 0, "and no history step was taken");
  ok(h.executor.summary() === null, "and the run has nothing to summarise");
}

heading("markdown round trips over the seed's text");
{
  let blocks = 0;
  let exact = 0;
  for (const issue of issues)
    for (const p of issue.content.pages)
      for (const b of p.blocks) {
        if (b.type !== "text") continue;
        blocks++;
        const doc = docOf(b);
        // Empty paragraphs don't survive markdown; everything else must.
        const kept = {
          ...doc,
          content: doc.content.filter(
            (n) => n.type !== "paragraph" || (n.content?.length ?? 0) > 0,
          ),
        };
        const back = markdownToDoc(docToMarkdown(doc)).doc;
        if (JSON.stringify(back) === JSON.stringify(kept)) exact++;
      }
  ok(
    blocks > 50 && exact === blocks,
    `${exact} of ${blocks} seed text blocks round-trip`,
  );
  const odd = markdownToDoc(
    "# A heading\n\n> a quote\n\n| a | b |\n|---|---|\n\n```\ncode\n```\n\n<b>html</b> and ![img](x.png)",
  );
  ok(
    richDocSchema.safeParse(odd.doc).success &&
      richTextToPlain(odd.doc).includes("A heading") &&
      richTextToPlain(odd.doc).includes("a quote") &&
      richTextToPlain(odd.doc).includes("code"),
    "unknown syntax degrades to text and still validates",
  );
}

heading("a run is one history step; undo restores it exactly");
{
  const start = [
    cover,
    page(headingBlock("Harbour news"), textBlock(3)),
    page(),
  ];
  const h = harness(start);
  const before = JSON.stringify(h.pages);
  const [, second] = h.pages;
  const textId = second!.blocks[1]!.id;
  h.executor.beginRun();
  const a = await h.run("set_text", {
    blockId: textId,
    markdown: "One.\n\nTwo.",
  });
  const b = await h.run("insert_blocks", {
    after: { blockId: textId },
    blocks: [
      { kind: "heading", title: "More", level: "section" },
      { kind: "text", markdown: "- first\n- second" },
    ],
  });
  const c = await h.run("move_block", { blockId: textId, after: { page: 3 } });
  ok(
    !a.text.startsWith("Error") &&
      !b.text.startsWith("Error") &&
      !c.text.startsWith("Error"),
    "three edits applied",
  );
  ok(
    /page 2: fits, ~\d+% full/.test(a.text),
    `each result ends with the page's fill (${a.text})`,
  );
  ok(h.history.length === 1, `exactly one history entry (${h.history.length})`);
  ok(
    JSON.stringify(h.history[0]!.pages) === before,
    "and it holds the pre-run pages byte for byte",
  );
  ok(h.pages[0] === start[0], "untouched pages keep their identity");
  const summary = h.executor.summary();
  // The text was rewritten and moved (one block), and two were inserted.
  ok(
    summary?.text === "Changed 3 blocks on pages 2–3",
    `the run summary: ${summary?.text}`,
  );
  h.set(h.history.pop()!);
  ok(
    JSON.stringify(h.pages) === before,
    "undo restores the pre-run pages exactly",
  );
  h.executor.beginRun();
  await h.run("add_page", { after: 1 });
  await h.run("add_page", { after: 1 });
  ok(h.history.length === 1, "the next run takes its own single step");
  ok(
    h.executor.summary()?.text === "Added 2 pages",
    `and summarises it (${h.executor.summary()?.text})`,
  );
}

heading("photo layout");
{
  const h = harness([cover, page(photo(60, "left"), textBlock(2))]);
  const id = h.pages[1]!.blocks[0]!.id;
  const width = () => (h.pages[1]!.blocks[0] as { width: number }).width;
  await h.run("set_image_layout", { blockId: id, align: "full" });
  ok(width() === 100, "full with no width is full width (100%)");
  await h.run("set_image_layout", { blockId: id, align: "right" });
  ok(width() === 45, "a float from full width takes 45%");
  await h.run("set_image_layout", { blockId: id, align: "left", width: 38 });
  await h.run("set_image_layout", { blockId: id, align: "right" });
  ok(width() === 38, "a float keeps a float's width");
  await h.run("insert_blocks", {
    after: { page: 2 },
    blocks: [
      {
        kind: "image",
        imageId: [...photos][1]!,
        caption: "The quay",
        alt: "Boats at the quay",
      },
    ],
  });
  const placed = h.pages[1]!.blocks[0] as {
    caption: string;
    alt: string;
    width: number;
  };
  ok(
    placed.caption === "The quay" &&
      placed.alt === "Boats at the quay" &&
      placed.width === 100,
    "an inserted photo takes its caption and alt",
  );
  const out = await h.run("set_image_text", { blockId: id, caption: "" });
  ok(
    out.text.startsWith("Updated the photo's caption"),
    "a caption can be cleared",
  );
}

heading("split_page and the overflow feedback");
{
  // 60 + 18 × 40 = 780 fits; the 8-paragraph text after it doesn't.
  const intro = textBlock(18, "Intro");
  const long = textBlock(8, "Long");
  const after = photo(40);
  const h = harness([
    cover,
    page(headingBlock("Regatta"), intro, headingBlock("Results"), long, after),
    page(textBlock(1)),
  ]);
  const out = await h.run("set_text", {
    blockId: long.id,
    markdown:
      "One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.\n\nSix.\n\nSeven.\n\nEight.",
  });
  ok(
    /page 2: overflows by ~\d+ lines/.test(out.text),
    "an overflow is reported",
  );
  ok(
    out.text.includes(
      `[${intro.id}] 36 lines, its paragraphs' last lines hold 3`,
    ),
    "with each text block's lines and last lines",
  );
  ok(out.text.includes("split_page 2"), "and offers split_page");
  const split = await h.run("split_page", { page: 2 });
  const [p2, p3, p4] = [h.pages[1]!, h.pages[2]!, h.pages[3]!];
  ok(
    p2.blocks.map((b) => b.id).join() ===
      `${h.pages[1]!.blocks[0]!.id},${intro.id}`,
    "the page keeps what fits",
  );
  ok(
    p3.blocks[0]?.type === "heading" &&
      p3.blocks[1]?.id === long.id &&
      p3.blocks[2]?.id === after.id,
    "the stranded heading, the text and the photo after it move on, in order",
  );
  ok(p4.blocks.length === 1, "the next page is untouched and renumbered");
  ok(
    /Moved 3 blocks onto a new page 3.*page 2: fits.*page 3: fits/.test(
      split.text,
    ),
    `the result names both pages (${split.text})`,
  );

  // A text block that crosses the foot is split between paragraphs.
  const flowing = textBlock(24, "Flow");
  const h2 = harness([cover, page(headingBlock("Notes"), flowing, photo(40))]);
  await h2.run("split_page", { page: 2 });
  const kept = h2.pages[1]!.blocks[1] as Extract<Block, { type: "text" }>;
  const moved = h2.pages[2]!.blocks;
  ok(
    richDocBlocks(kept.text).length === 18,
    `the text keeps the paragraphs that fit (${richDocBlocks(kept.text).length})`,
  );
  ok(
    moved[0]?.type === "text" &&
      richDocBlocks((moved[0] as typeof kept).text).length === 6 &&
      moved[1]?.type === "image",
    "the rest continues on the new page, the photo after it",
  );
  ok(
    richTextToPlain(kept.text) +
      "\n" +
      richTextToPlain((moved[0] as typeof kept).text) ===
      richTextToPlain(flowing.text),
    "no words are lost or changed",
  );
  const alone = harness([cover, page(photo(100), textBlock(30))]);
  ok(
    (await alone.run("split_page", { page: 2 })).text.startsWith("Moved"),
    "a page led by a photo splits its text",
  );

  // 60 + 17 × 40 + 180 = 920: a 120px overflow the 180px photo would clear.
  const small = textBlock(17);
  const tallPhoto = photo(60);
  const h3 = harness([
    cover,
    page(headingBlock("Club news"), small, tallPhoto),
  ]);
  const told = await h3.run("set_image_text", {
    blockId: tallPhoto.id,
    alt: "Dinghies",
  });
  ok(
    told.text.includes(`Moving [${tallPhoto.id}] (photo, ~`) &&
      !told.text.includes(`Moving [${small.id}]`),
    `names a block tall enough to move off (${told.text})`,
  );
}

heading("covers, full-page photos and whole-issue validation");
{
  const fullPhoto = { ...photo(), align: "page-fill" } as Block;
  const h = harness([cover, page(fullPhoto), page(textBlock(2))]);
  const t = h.pages[2]!.blocks[0]!.id;
  ok(
    (
      await h.run("move_block", { blockId: t, after: { page: 2 } })
    ).text.includes("full-page photo"),
    "nothing goes onto a full-page photo",
  );
  ok(
    (
      await h.run("set_image_layout", { blockId: fullPhoto.id, align: "full" })
    ).text.includes("full-page photos can't"),
    "a full-page photo keeps its layout",
  );
  // A block the save path would refuse anywhere in the issue blocks every edit.
  const broken = { ...headingBlock("x"), title: "x".repeat(301) } as Block;
  const bad = harness([cover, page(broken), page(textBlock(2))]);
  const before = JSON.stringify(bad.pages);
  const out = await bad.run("add_page", { after: 3 });
  ok(
    out.text.includes("would make the issue invalid") &&
      JSON.stringify(bad.pages) === before &&
      bad.history.length === 0,
    "an edit that leaves the issue invalid is rolled back",
  );
}

heading("an author edit mid-call wins");
{
  const edited = [cover, page(textBlock(2))];
  let state: EditorSnapshot = {
    pages: [cover, page(textBlock(30))],
    curPage: 1,
    sel: null,
  };
  const racingMeasure: EditMeasurer = {
    ...measurer,
    async report(p) {
      state = { pages: edited, curPage: 1, sel: null };
      return measurer.report(p);
    },
  };
  const r2 = createAssistantExecutor({
    measure: racingMeasure,
    handle: { state: () => state, apply: async (n) => void (state = n) },
  });
  const out = await r2.run("split_page", { page: 2 }, call);
  ok(
    out.text.includes("author changed the issue") && state.pages === edited,
    "the executor refuses rather than overwrite it",
  );
}

heading("the circuit-breaker");
{
  const h = harness([cover, page(textBlock(2), headingBlock("A")), page()]);
  const id = h.pages[1]!.blocks[1]!.id;
  h.executor.beginRun();
  for (let i = 0; i < 3; i++) {
    await h.run("move_block", { blockId: id, after: { page: i % 2 ? 2 : 3 } });
    ok(
      h.executor.breaker() === (i < 2 ? null : BREAKER_MESSAGE),
      `move ${i + 1} of one block: ${h.executor.breaker() ? "stops" : "carries on"}`,
    );
  }
  h.executor.beginRun();
  for (let i = 0; i < 40; i++) await h.run("read_page", { page: 2 });
  ok(h.executor.breaker() === null, "40 tool calls are allowed");
  await h.run("read_page", { page: 2 });
  ok(h.executor.breaker() === BREAKER_MESSAGE, "the 41st stops the run");
  ok(
    BREAKER_MESSAGE ===
      "I got stuck, so I stopped. Everything I did is in place and can be undone in one step.",
    "with the agreed words",
  );
}

heading("formatting");
ok(
  formatPages([5, 4]) === "4–5" &&
    formatPages([2, 7, 4, 5]) === "2, 4–5 and 7" &&
    formatPages([3]) === "3",
  "page lists read naturally",
);
ok(
  h.measured > 0 && collectImageIds(issues[0]!.content).length > 0,
  "the stand-in measurer and seed were used",
);

console.log(h.failures ? `\n${h.failures} failed` : "\nall passed");
process.exit(h.failures ? 1 : 0);
