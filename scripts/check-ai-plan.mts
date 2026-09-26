// The assistant's section plan (#312), in memory: propose_sections places each
// section from the top of a fresh page, headline / kicker / standfirst where
// the plan put them, sub-heads and photos in the body, continuation pages when
// a body runs long, no page past its text area, one history step for the lot,
// and photo suggestions in the author's run summary. The stand-in measurer is
// fixtures/assistant/tools-harness.mts; the real one is the gate's.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-plan.mts
import type { Block, Page } from "../src/lib/blocks";
import { richTextToPlain } from "../src/lib/rich-text-doc";
import * as h from "./fixtures/assistant/tools-harness.mts";

const { ok, heading, harness, measurer, photos } = h;
const { textBlock, cover, page } = h;
const photo = [...photos][0]!;

const paras = (n: number, label: string) =>
  Array.from({ length: n }, (_, i) => `${label} paragraph ${i + 1}.`).join(
    "\n\n",
  );
const kinds = (p: Page) =>
  p.blocks
    .map((b) => (b.type === "heading" ? `h:${b.level}` : b.type))
    .join(" ");
const plain = (b: Block | undefined) =>
  b?.type === "text" ? richTextToPlain(b.text) : "";
const fits = async (p: Page) => (await measurer.report(p)).overflowAt === null;

heading("eight sections, each from the top of a fresh page");
{
  const x = harness([cover, page(textBlock(2)), page(textBlock(1, "Last"))]);
  const sections = Array.from({ length: 8 }, (_, i) => ({
    headline: `STORY ${i + 1}`,
    ...(i === 0 ? { kicker: "Club Notes" } : {}),
    standfirst: `Standfirst ${i + 1}.`,
    // Story 3 runs to three pages; 40px a paragraph on an 800px page.
    body: paras(i === 2 ? 45 : 6, `S${i + 1}`),
  }));
  const original = JSON.stringify(x.pages);
  const [, second, third] = x.pages;
  x.executor.beginRun();
  const out = await x.run("propose_sections", { after: 2, sections });
  console.log(`    → ${out.text.slice(0, 300)}…`);
  const pages = x.pages;
  const tops = pages
    .map((p, i) => ({ i, first: p.blocks[0] }))
    .filter(({ first }) => first?.type === "heading" && first.level === "main");
  ok(
    tops.length === 8 &&
      tops.every(
        ({ first }, n) =>
          first?.type === "heading" && first.title === `STORY ${n + 1}`,
      ),
    "every section's headline is the main heading at the top of its own page",
  );
  const first = pages[tops[0]!.i]!;
  ok(
    first.blocks[0]?.type === "heading" &&
      first.blocks[0].kicker === "Club Notes" &&
      plain(first.blocks[1]) === "Standfirst 1." &&
      tops.slice(1).every(({ i }) => {
        const b = pages[i]!.blocks[0];
        return b?.type === "heading" && b.kicker === "";
      }),
    "the kicker sits on its heading, the standfirst is the text under it, no invented kickers",
  );
  ok(
    pages.length === 3 + 8 + 2 && pages[1] === second && pages.at(-1) === third,
    `story 3 carried onto two more pages, the pages around the plan untouched (${pages.length} pages)`,
  );
  const all = (await Promise.all(pages.map(fits))).every(Boolean);
  ok(all, "no page runs past its text area");
  const words = pages
    .slice(3, -1)
    .flatMap((p) => p.blocks.map(plain))
    .join(" ");
  ok(
    Array.from({ length: 45 }, (_, i) => `S3 paragraph ${i + 1}.`).every((s) =>
      words.includes(s),
    ),
    "every paragraph of the long story is placed, once",
  );
  ok(
    x.history.length === 1 && JSON.stringify(x.history[0]!.pages) === original,
    "one history step, back to the issue as it was",
  );
  const summary = x.executor.summary();
  ok(
    summary?.text === "Changed 26 blocks on pages 3–12 and added 10 pages",
    `the run's line: ${summary?.text}`,
  );
}

heading("an empty page takes the first section; sub-heads and photos");
{
  const x = harness([cover, page()]);
  x.executor.beginRun();
  const out = await x.run("propose_sections", {
    after: 2,
    sections: [
      {
        headline: "Garden",
        body: `${paras(2, "A")}\n\n## Planting\n\n${paras(2, "B")}\n\n### Leeks\n\nC.`,
        photos: [
          { imageId: photo, after: 1, align: "right" },
          { imageId: photo, align: "left" },
          { after: 2 },
        ],
      },
    ],
  });
  ok(
    x.pages.length === 2 &&
      out.text.startsWith('Placed 1 section on page 2: "Garden" on page 2.'),
    `the empty page 2 took the section, nothing after it renumbered (${out.text.slice(0, 60)}…)`,
  );
  ok(
    kinds(x.pages[1]!) ===
      "h:main image text image text h:section text h:paragraph text",
    `blocks in reading order: ${kinds(x.pages[1]!)}`,
  );
  const wrapped = x.pages[1]!.blocks[3];
  ok(
    wrapped?.type === "image" &&
      wrapped.align === "right" &&
      wrapped.width === 45,
    "a photo after paragraph 1, wrapped right at 45%",
  );
  ok(
    out.text.includes('Suggested a photo for "Garden"') &&
      x.executor.summary()?.text.endsWith('. Suggested a photo for "Garden".'),
    "a photo without an id is a suggestion in the result and the run's line",
  );
}

heading("refusals change nothing");
{
  const x = harness([cover, page(textBlock(2))]);
  const before = JSON.stringify(x.pages);
  for (const [input, want] of [
    [{ after: 9, sections: [{ headline: "H", body: "B." }] }, "no page 9"],
    [
      {
        after: 2,
        sections: [
          { headline: "H", body: "B.", photos: [{ imageId: "nope" }] },
        ],
      },
      "isn't a photo uploaded",
    ],
  ] as const) {
    const out = await x.run("propose_sections", input);
    ok(
      out.text.includes(want) && JSON.stringify(x.pages) === before,
      `refused: ${out.text.slice(0, 120)}`,
    );
  }
}

console.log(h.failures ? `\n${h.failures} failed` : "\nall passed");
process.exit(h.failures ? 1 : 0);
