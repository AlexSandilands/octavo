// The cover tools' half of check-ai-tools.mts (#313), in memory: the zod
// (no fonts, 1–6 story items), the refusals (a heading that isn't there, an
// item that isn't on a cover, a page tool aimed at a cover), the compose tools
// leaving interior pages alone, a whole composition validated by the save
// path's schema and undone in one step, the cover line and warnings in every
// result, and the run summary counting cover items.
import { issueContentSchema, CONTENT_VERSION } from "../../../src/lib/blocks";
import { coverElementSchema } from "../../../src/lib/cover-elements";
import { aiToolSchemas } from "../../../src/lib/ai-tools";
import * as h from "./tools-harness.mts";

const { ok, heading, harness, headingBlock, textBlock, cover, page, photos } =
  h;

export async function coverChecks() {
  heading("cover tools: the contract");
  const refused = (tool: keyof typeof aiToolSchemas, input: unknown) =>
    !aiToolSchemas[tool].safeParse(input).success;
  const item = { title: "A story" };
  for (const [tool, input, why] of [
    ["add_story", { items: [] }, "no items"],
    ["add_story", { items: Array(7).fill(item) }, "seven items"],
    ["style_cover_item", { id: "a", font: "newsreader" }, "a font"],
    ["style_cover_item", { id: "a", weight: 700 }, "a weight"],
    ["style_cover_item", { id: "a", text: "red" }, "a colour off the palette"],
    [
      "place_cover_item",
      { id: "a", column: "middle", row: "top", width: "wide", align: "left" },
      "a column",
    ],
    ["add_logo", { logo: "Burgee", size: 20 }, "a logo under 40px"],
    ["set_cover_background", { imageId: "x", fit: "stretch" }, "a fit"],
  ] as const)
    ok(refused(tool, input), `${tool}'s zod refuses ${why}`);

  heading("cover tools: refusals change nothing");
  const lead = headingBlock("The twilight league");
  const second = headingBlock("New boats");
  const third = headingBlock("Working bee");
  const body = textBlock(2);
  {
    const x = harness([
      { ...cover, blocks: [headingBlock("Masthead")] },
      page(lead, body),
    ]);
    const before = JSON.stringify(x.pages);
    const masthead = x.pages[0]!.blocks[0]!.id;
    for (const [tool, input, want] of [
      ["add_story", { items: [{ headingId: "nope" }] }, "isn't an interior"],
      [
        "add_story",
        { items: [{ description: "x" }] },
        "a headingId or a title",
      ],
      ["add_logo", { logo: "Crest" }, 'no logo is called "Crest"'],
      [
        "set_cover_background",
        { imageId: "nope", fit: "fill" },
        "isn't a photo",
      ],
      ["clear_cover_background", {}, "no background"],
      ["remove_cover_item", { id: body.id }, "isn't a cover"],
      [
        "place_cover_item",
        {
          id: lead.id,
          column: "left",
          row: "top",
          width: "wide",
          align: "left",
        },
        "isn't a cover",
      ],
      ["style_cover_item", { id: body.id, text: "ink" }, "isn't a cover"],
      ["style_cover_item", { id: "nope", text: "ink" }, "no cover item"],
      [
        "set_heading",
        { blockId: masthead, title: "X", level: "main" },
        "use the cover tools",
      ],
    ] as const) {
      const out = await x.run(tool, input);
      ok(
        out.text.startsWith("Error:") && out.text.includes(want),
        `${tool}: ${out.text}`,
      );
    }
    ok(
      JSON.stringify(x.pages) === before && x.history.length === 0,
      "and nothing changed",
    );
  }

  heading("cover tools: a whole cover, one step, validated");
  const x = harness([cover, page(lead, body), page(second), page(third)]);
  const start = JSON.stringify(x.pages);
  const interior = JSON.stringify(x.pages.slice(1));
  x.executor.beginRun();
  const [shot] = [...photos];
  const steps: [string, object][] = [
    ["set_cover_background", { imageId: shot, fit: "fill", alt: "Dusk" }],
    ["set_masthead", { title: "Regatta", kicker: "The club magazine" }],
    [
      "add_story",
      {
        items: [
          { headingId: lead.id, title: "Racing at dusk", description: "Why." },
          { headingId: second.id },
          { headingId: third.id },
        ],
        headlineSize: "large",
      },
    ],
    ["add_details", { text: "Spring 2026" }],
    ["add_logo", { logo: "club burgee", size: 80 }],
  ];
  const outs: string[] = [];
  for (const [tool, input] of steps) outs.push((await x.run(tool, input)).text);
  ok(
    outs.every((o) => !o.startsWith("Error")),
    `the five compose calls applied (${outs.map((o) => o.split(".")[0]).join("; ")})`,
  );
  ok(
    outs
      .at(-1)
      ?.includes(
        "The cover (page 1) now has a background photo, a masthead, 1 story, issue details, 1 logo.",
      ) && outs.at(-1)?.includes("No layout warnings."),
    "each result ends with what the cover holds and its warnings",
  );
  const els = x.pages[0]!.coverElements ?? [];
  const story = els.find((e) => e.type === "story")!;
  const details = els.find((e) => e.type === "details")!;
  for (const [tool, input] of [
    [
      "place_cover_item",
      {
        id: story.id,
        column: "left",
        row: "bottom",
        width: "medium",
        align: "left",
        textSize: "large",
      },
    ],
    ["style_cover_item", { id: story.id, text: "paper", shadow: "soft" }],
    [
      "place_cover_item",
      {
        id: details.id,
        column: "right",
        row: "top",
        width: "narrow",
        align: "right",
      },
    ],
    ["style_cover_item", { id: details.id, panel: true, background: "ink" }],
    ["style_cover_page", { text: "paper", frame: false }],
  ] as const)
    ok(!(await x.run(tool, input)).text.startsWith("Error"), `${tool} applied`);
  const coverPage = x.pages[0]!;
  ok(
    issueContentSchema.safeParse({ version: CONTENT_VERSION, pages: x.pages })
      .success &&
      (coverPage.coverElements ?? []).every(
        (e) => coverElementSchema.safeParse(e).success,
      ),
    "the composed cover validates through the save path's schema",
  );
  ok(
    JSON.stringify(x.pages.slice(1)) === interior,
    "the compose tools, run from page 2, left every interior page alone",
  );
  const placed = coverPage.coverElements!.find((e) => e.id === story.id)!;
  ok(
    placed.placement.row === "bottom" &&
      placed.placement.appearance?.text === "paper" &&
      coverPage.coverOverlay?.masthead === false &&
      coverPage.coverOverlay.decoration === false,
    "placement, paint and the page's defaults landed",
  );
  const summary = x.executor.summary();
  ok(
    x.history.length === 1 &&
      /^Changed \d+ blocks on page 1$/.test(summary?.text ?? ""),
    `one history step, and the line counts cover items (${summary?.text})`,
  );
  ok(
    JSON.stringify(x.history[0]!.pages) === start,
    "undo restores the empty cover exactly",
  );

  heading("cover tools: a lost link is a warning in words");
  x.executor.beginRun();
  await x.run("delete_block", { blockId: third.id });
  const warned = await x.run("style_cover_page", { shadow: "soft" });
  ok(
    warned.text.includes("links to a section that no longer exists"),
    `the next cover result says so (${warned.text.split("Layout warnings: ")[1]})`,
  );
}
