// The assistant's runs (#310), in memory: one history step per run with undo
// back to the exact pages, an author edit during a call or between calls
// stopping the run, the circuit-breaker, and the run's summary line. The
// tools' own contract and edits are check-ai-tools.mts; same stand-in measurer.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-runs.mts
import type { EditorSnapshot } from "../src/features/editor/use-editor-history";
import {
  BREAKER_MESSAGE,
  INTERRUPTED_MESSAGE,
  RUN_STALL_LIMIT,
  createAssistantExecutor,
  formatPages,
  summarizeRun,
} from "../src/features/editor/assistant/executor";
import type { EditMeasurer } from "../src/features/editor/assistant/page-report";
import { seenTextChecks } from "./fixtures/assistant/seen-text-checks.mts";
import * as h from "./fixtures/assistant/tools-harness.mts";

const { ok, heading, measurer, call, harness } = h;
const { textBlock, headingBlock, cover, page } = h;

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
    out.text.includes("the issue changed while you were working") &&
      state.pages === edited,
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

heading("the circuit-breaker: trimming that stalls (#355)");
{
  // 60 + 14 × 40 × 2 = 1180 on an 800px page; still over after six trims of one paragraph.
  const paras = (n: number) =>
    Array.from({ length: n }, (_, i) => `Para ${i + 1}.`).join("\n\n");
  const [a, b] = [textBlock(14), textBlock(14)];
  const h = harness([cover, page(headingBlock("Notes"), a, b)]);
  h.executor.beginRun();
  const trims = [a, b, a, b, a, b];
  for (const [i, blk] of trims.entries()) {
    await h.run("set_text", {
      blockId: blk.id,
      markdown: paras(13 - (i >> 1)),
    });
    const want = i + 1 === trims.length ? BREAKER_MESSAGE : null;
    ok(
      h.executor.breaker() === want,
      `trim ${i + 1} (${i < 2 ? "first pass" : `repeat ${i - 1}`}), still overflowing: ${want ? "stops" : "carries on"}`,
    );
  }
  ok(RUN_STALL_LIMIT === 4, "the stall is the 4th re-trim in a row");

  // One pass over many blocks is progress, not a stall.
  const many = Array.from({ length: 8 }, () => textBlock(3));
  const h2 = harness([cover, page(headingBlock("Notes"), ...many)]);
  h2.executor.beginRun();
  for (const blk of many)
    await h2.run("set_text", { blockId: blk.id, markdown: paras(3) });
  ok(h2.executor.breaker() === null, "8 blocks trimmed once each carry on");

  // Another kind of edit, or a page that fits, ends the streak.
  const [c, d] = [textBlock(12), textBlock(12)];
  const h3 = harness([cover, page(headingBlock("Notes"), c, d)]);
  h3.executor.beginRun();
  for (const blk of [c, d, c, d, c])
    await h3.run("set_text", { blockId: blk.id, markdown: paras(12) });
  await h3.run("set_heading", {
    blockId: h3.pages[1]!.blocks[0]!.id,
    title: "More notes",
    level: "main",
  });
  for (const blk of [c, d, c])
    await h3.run("set_text", { blockId: blk.id, markdown: paras(12) });
  ok(h3.executor.breaker() === null, "another edit starts the count again");
  await h3.run("set_text", { blockId: c.id, markdown: paras(2) });
  for (const blk of [d, d, d, d])
    await h3.run("set_text", { blockId: blk.id, markdown: paras(12) });
  ok(
    h3.executor.breaker() === null,
    "re-trims once the page fits aren't a stall",
  );
}

heading("the run summary counts moves");
{
  const [a, b, c] = [textBlock(1, "A"), textBlock(1, "B"), textBlock(1, "C")];
  const before = [cover, page(a, b, c), page(headingBlock("Z"))];
  const within = [before[0]!, page(a, c, b), before[2]!].map((p, i) => ({
    ...p,
    id: before[i]!.id,
  }));
  ok(
    summarizeRun(before, within)?.text === "Changed 1 block on page 2",
    `a block moved within its page is one change (${summarizeRun(before, within)?.text})`,
  );
  const across = [
    before[0]!,
    { ...before[1]!, blocks: [a, b] },
    { ...before[2]!, blocks: [...before[2]!.blocks, c] },
  ];
  ok(
    summarizeRun(before, across)?.text === "Changed 1 block on page 3",
    "a block moved to another page is one change, where it landed",
  );
  ok(summarizeRun(before, before) === null, "no change is no summary");
}

heading("formatting");
ok(
  formatPages([5, 4]) === "4–5" &&
    formatPages([2, 7, 4, 5]) === "2, 4–5 and 7" &&
    formatPages([3]) === "3",
  "page lists read naturally",
);

heading("a change between a run's calls stops it");
{
  const [a, b] = [textBlock(2, "A"), textBlock(2, "B")];
  const h1 = harness([cover, page(a, b)]);
  const before = JSON.stringify(h1.pages);
  h1.executor.beginRun();
  await h1.run("set_text", { blockId: a.id, markdown: "RUN EDIT ONE" });
  const step = h1.executor.summary()?.step;
  ok(step === h1.history[0], "the run's summary carries its one history step");
  // The author types into another block between the run's calls.
  const typed = [cover, page(a, { ...b, text: { type: "doc", content: [] } })];
  const afterFirst = h1.pages;
  h1.set({
    pages: [
      afterFirst[0]!,
      {
        ...afterFirst[1]!,
        blocks: [afterFirst[1]!.blocks[0]!, typed[1]!.blocks[1]!],
      },
    ],
    curPage: 1,
    sel: null,
  });
  const edited = h1.pages;
  const second = await h1.run("set_text", {
    blockId: a.id,
    markdown: "RUN EDIT TWO",
  });
  ok(
    second.text.includes("the issue changed while you were working") &&
      h1.pages === edited,
    "the next call is refused and the author's edit stands",
  );
  ok(
    h1.executor.breaker() === INTERRUPTED_MESSAGE,
    "the breaker stops the run and says why",
  );
  const third = await h1.run("insert_blocks", {
    after: { page: 2 },
    blocks: [{ kind: "text", markdown: "x" }],
  });
  ok(
    third.text.includes("has stopped") && h1.history.length === 1,
    "nothing more lands, and the run kept one step",
  );
  ok(
    JSON.stringify(h1.history[0]!.pages) === before,
    "that step is still the pre-run pages",
  );
  ok(
    h1.executor.summary()?.text === "Changed 1 block on page 2",
    "the summary counts only the run's own change",
  );
}

await seenTextChecks();

heading("propose_sections: sub-heads, and a long blank run is quick");
{
  const plan = (body: string) => ({
    after: 2,
    sections: [{ headline: "Spring show", body }],
  });
  const h1 = harness([cover, page()]);
  h1.executor.beginRun();
  const out = await h1.run(
    "propose_sections",
    plan("The doors opened.\n## Judging ##\nRosettes."),
  );
  const titles = h1.pages
    .flatMap((p) => p.blocks)
    .flatMap((b) => (b.type === "heading" ? [b.title] : []));
  ok(
    !out.text.startsWith("Error:") && titles.includes("Judging"),
    "a sub-head becomes a heading, closing #s trimmed",
  );
  // Once cubic in the heading test: seconds per line of this.
  const blank = `# a${" ".repeat(15_000)}x`;
  const started = Date.now();
  await h1.run("propose_sections", plan(blank));
  const ms = Date.now() - started;
  ok(ms < 500, `a heading line with a long blank run is quick (${ms}ms)`);
  // A text block's markdown has its own heading test (markdown-doc.ts).
  const bold = await h1.run("insert_blocks", {
    after: { page: 2 },
    blocks: [{ kind: "text", markdown: "## Judging ##" }],
  });
  const began = Date.now();
  await h1.run("insert_blocks", {
    after: { page: 2 },
    blocks: [{ kind: "text", markdown: `# a${" ".repeat(39_000)}x` }],
  });
  const took = Date.now() - began;
  ok(
    bold.text.includes('"Judging" was a markdown heading') && took < 500,
    `and in a text block's markdown (${took}ms)`,
  );
}

console.log(h.failures ? `\n${h.failures} failed` : "\nall passed");
process.exit(h.failures ? 1 : 0);
