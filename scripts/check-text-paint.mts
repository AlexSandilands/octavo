// Colour and typeface on interior text (content v11, aboard #24), in memory:
// the paint mark and heading paint through the save schema (tampered values
// drop), a split and the issue-transfer document keep them, and the assistant's
// side — set_heading's color/font, style_text, set_text carrying paint onto
// kept words, and the projection's `styled:` lines. No database, no spend.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-text-paint.mts
import {
  CONTENT_VERSION,
  headingBlockSchema,
  issueContentSchema,
  type Block,
} from "../src/lib/blocks";
import { aiToolSchemas, AI_TOOL_NAMES } from "../src/lib/ai-tools";
import { richDocSchema, type RichDoc } from "../src/lib/rich-text-doc";
import { richDocBlocks, sliceRichDoc } from "../src/lib/rich-text-split";
import { checkBundledIssue } from "../src/lib/issue-transfer/document";
import { paintStyle } from "../src/lib/text-paint";
import { pageView } from "../src/features/editor/assistant/projection";
import {
  carryPaint,
  paintRuns,
  styleWords,
} from "../src/features/editor/assistant/text-styling";
import * as h from "./fixtures/assistant/tools-harness.mts";

const { ok, heading, harness, cover, page, textBlock, headingBlock } = h;

const doc = (...paras: RichDoc["content"]): RichDoc => ({
  type: "doc",
  content: paras,
});
const run = (text: string, marks?: unknown[]) =>
  marks ? { type: "text", text, marks } : { type: "text", text };
const p = (...content: unknown[]) =>
  ({ type: "paragraph", content }) as RichDoc["content"][number];
const green = { type: "paint", attrs: { color: "green", font: null } };

heading("the content model");
ok(CONTENT_VERSION === 11, "content version 11");
{
  const parsed = richDocSchema.parse(
    doc(
      p(
        run("Green", [green]),
        run(" hex", [{ type: "paint", attrs: { color: "#aa3300" } }]),
        run(" bad", [{ type: "paint", attrs: { color: "red;x", font: "x" } }]),
        run(" mixed", [
          { type: "bold" },
          { type: "paint", attrs: { color: "url(x)", font: "newsreader" } },
        ]),
      ),
    ),
  );
  const marks = (
    parsed.content[0] as { content: { marks?: unknown[] }[] }
  ).content.map((n) => JSON.stringify(n.marks ?? []));
  ok(
    marks[0] === '[{"type":"paint","attrs":{"color":"green"}}]',
    "a palette colour keeps, Tiptap's null font drops",
  );
  ok(marks[1]!.includes("#aa3300"), "a 6-digit hex keeps");
  ok(marks[2] === "[]", "a tampered colour and font drop the whole mark");
  ok(
    marks[3] ===
      '[{"type":"bold"},{"type":"paint","attrs":{"font":"newsreader"}}]',
    "a bad colour drops beside a good font; other marks stay",
  );
  const head = (paint: unknown) =>
    headingBlockSchema.parse({ id: "h", type: "heading", title: "T", paint });
  ok(
    JSON.stringify(head({ color: "blue", font: "hanken-grotesk" }).paint) ===
      '{"color":"blue","font":"hanken-grotesk"}',
    "a heading's paint parses",
  );
  ok(
    head({ color: "javascript:1" }).paint === undefined,
    "a heading's tampered paint drops, the heading saves",
  );
  ok(
    paintStyle({ color: "green", font: "newsreader" })?.color ===
      "var(--color-accent)" &&
      paintStyle({ font: "newsreader" })?.fontFamily ===
        "var(--font-cover-newsreader)",
    "paint renders through the palette vars and cover fonts",
  );
  ok(paintStyle(undefined) === undefined, "no paint, no style");
}

heading("splits and the transfer document keep paint");
{
  const styled = doc(p(run("One", [green])), p(run("Two", [green])));
  const blocks = richDocBlocks(styled);
  ok(
    JSON.stringify(sliceRichDoc(blocks, 1, 2)).includes('"color":"green"'),
    "an overflow split's second half keeps its paint",
  );
  const content = {
    version: CONTENT_VERSION,
    pages: [
      {
        id: "p",
        blocks: [
          { id: "t", type: "text", text: styled },
          {
            id: "h",
            type: "heading",
            title: "T",
            paint: { color: "#123456", font: "comic-sans" },
          },
        ],
      },
    ],
  };
  const saved = issueContentSchema.parse(content);
  ok(
    JSON.stringify(saved.pages[0]!.blocks[1]) ===
      JSON.stringify({
        id: "h",
        type: "heading",
        kicker: "",
        title: "T",
        paint: { color: "#123456" },
      }),
    "the save path drops an unknown font and keeps the colour",
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
    bundled.ok &&
      JSON.stringify(bundled.issue.content).includes('"color":"green"'),
    "an imported bundle keeps body-text paint",
  );
  ok(
    bundled.ok && !JSON.stringify(bundled.issue.content).includes("comic-sans"),
    "and drops a tampered heading font",
  );
}

heading("the tool contract");
ok(AI_TOOL_NAMES.at(-1) === "style_text", "style_text is declared last");
const refused = (tool: keyof typeof aiToolSchemas, input: unknown) =>
  !aiToolSchemas[tool].safeParse(input).success;
ok(
  refused("style_text", { blockId: "a", color: "red" }) &&
    refused("style_text", { blockId: "a", font: "arial" }) &&
    refused("style_text", { blockId: "a", match: "" }) &&
    refused("set_heading", {
      blockId: "a",
      title: "T",
      level: "main",
      color: "#fff",
    }),
  "colour and font arguments are bounded",
);
ok(
  !refused("style_text", { blockId: "a", color: "theme", font: "theme" }) &&
    !refused("set_heading", {
      blockId: "a",
      title: "T",
      level: "main",
      color: "#AA0000",
      font: "roboto-condensed",
    }),
  '"theme", hex and the three fonts are accepted',
);

heading("style_text, set_heading and set_text in the editor");
{
  const body = {
    ...textBlock(1),
    text: doc(
      p(run("The spring show drew a record crowd.")),
      p(run("Book for the spring show now.")),
    ),
  } as Block;
  const title = headingBlock("Spring show");
  const ed = harness([cover, page(title, body)]);
  const at = () => ed.pages[1]!.blocks;
  const textOf = () =>
    (at()[1] as Extract<Block, { type: "text" }>).text as RichDoc;

  let out = await ed.run("style_text", { blockId: body.id, color: "blue" });
  ok(out.text.includes("give color, font or both") === false, "styled");
  out = await ed.run("style_text", { blockId: body.id });
  ok(out.text.includes("give color, font or both"), "no choice is refused");
  out = await ed.run("style_text", { blockId: title.id, color: "green" });
  ok(out.text.includes("set_heading"), "a heading is pointed at set_heading");
  out = await ed.run("style_text", {
    blockId: body.id,
    match: "autumn",
    color: "green",
  });
  ok(out.text.includes("isn't in block"), "a missing phrase is refused");

  await ed.run("style_text", { blockId: body.id, color: "theme" });
  ok(paintRuns(textOf()).length === 0, '"theme" clears the whole block');

  out = await ed.run("style_text", {
    blockId: body.id,
    match: "Spring Show",
    color: "green",
    font: "hanken-grotesk",
  });
  ok(
    out.text.includes("2 occurrences"),
    "a phrase matches every occurrence, case-insensitively when it must",
  );
  ok(
    JSON.stringify(paintRuns(textOf())) ===
      JSON.stringify([
        {
          text: "spring show",
          paint: { color: "green", font: "hanken-grotesk" },
        },
        {
          text: "spring show",
          paint: { color: "green", font: "hanken-grotesk" },
        },
      ]),
    "just those words carry the paint",
  );
  await ed.run("style_text", {
    blockId: body.id,
    match: "record crowd",
    font: "newsreader",
  });

  const view = pageView(
    {
      title: "T",
      theme: "classic",
      pages: ed.pages,
      images: {},
      uploads: [],
      logos: [],
      sponsorNames: [],
      fills: {},
    },
    2,
  );
  ok(
    view.includes(
      'styled: "spring show" (color green, font hanken-grotesk); "record crowd" (font newsreader); "spring show" (color green, font hanken-grotesk)',
    ),
    "read_page lists the styled words",
  );

  out = await ed.run("set_text", {
    blockId: body.id,
    markdown:
      "The spring show drew a huge crowd.\n\nBook for the spring show today.",
  });
  ok(
    JSON.stringify(paintRuns(textOf()).map((r) => r.text)) ===
      '["spring show","spring show"]',
    "set_text keeps paint on words it left alone",
  );
  ok(
    out.text.includes('dropped from changed words "record crowd"'),
    "and names the styled words it changed",
  );

  await ed.run("set_heading", {
    blockId: title.id,
    title: "Spring show",
    level: "main",
    color: "#7a1f1f",
    font: "roboto-condensed",
  });
  const head = () => at()[0] as Extract<Block, { type: "heading" }>;
  ok(
    head().paint?.color === "#7a1f1f" &&
      head().paint?.font === "roboto-condensed",
    "set_heading sets the title's colour and font",
  );
  await ed.run("set_heading", {
    blockId: title.id,
    title: "Spring show 2026",
    level: "main",
  });
  ok(head().paint?.color === "#7a1f1f", "omitting them keeps them");
  await ed.run("set_heading", {
    blockId: title.id,
    title: "Spring show 2026",
    level: "main",
    color: "theme",
    font: "theme",
  });
  ok(head().paint === undefined, '"theme" returns both to the theme');
}

heading("carryPaint, directly");
{
  const old = doc(
    p(run("a "), run("cat", [green]), run(" and a "), run("cat", [green])),
  );
  const next = doc(p(run("one cat and a cat and a dog")));
  const kept = carryPaint(old, next);
  ok(
    JSON.stringify(paintRuns(kept.doc).map((r) => r.text)) ===
      '["cat","cat"]' && !kept.dropped.length,
    "the nth styled occurrence maps to the nth occurrence",
  );
  const restyled = styleWords(old, undefined, { font: "newsreader" });
  ok(
    paintRuns(restyled.doc).every((r) => r.paint.font === "newsreader") &&
      paintRuns(restyled.doc).filter((r) => r.paint.color === "green")
        .length === 2,
    "a whole-block font keeps the words' own colours",
  );
}

console.log(h.failures ? `\n${h.failures} failed` : "\nall passed");
process.exit(h.failures ? 1 : 0);
