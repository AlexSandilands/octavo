// The cover tools' half of check-ai-tools.mts (#313), in memory: the zod
// (no fonts, 1–6 story items), the refusals (a heading that isn't there, an
// item that isn't on a cover, a page tool aimed at a cover), the compose tools
// leaving interior pages alone, a whole composition validated by the save
// path's schema and undone in one step, the cover line and warnings in every
// result, and the run summary counting cover items.
import { issueContentSchema, CONTENT_VERSION } from "../../../src/lib/blocks";
import {
  DEFAULT_COVER_OVERLAY,
  coverElementSchema,
  makeCoverElement,
} from "../../../src/lib/cover-elements";
import { makeBlock, type Block, type Page } from "../../../src/lib/blocks";
import { plainCoverDoc } from "../../../src/lib/cover-rich-text";
import { RUN_MOVE_LIMIT } from "../../../src/features/editor/assistant/executor";
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
  await reviewChecks(lead);
}

/** The #363 review's cases: what the editor shows is what the issue stores. */
async function reviewChecks(lead: Block) {
  heading("cover tools: only headings, text and photos take a placement");
  const sponsor = { ...makeBlock("sponsor"), name: "Chandlery" } as Block;
  {
    const x = harness([{ ...cover, blocks: [sponsor] }, page(lead)]);
    const before = JSON.stringify(x.pages);
    const out = await x.run("place_cover_item", {
      id: sponsor.id,
      column: "left",
      row: "top",
      width: "wide",
      align: "left",
    });
    ok(
      out.text.includes("a sponsor block can't be placed") &&
        JSON.stringify(x.pages) === before,
      `a sponsor on the cover is refused (${out.text.split(".")[0]})`,
    );
  }

  heading("cover tools: a paper cover keeps the editor's defaults");
  {
    const x = harness([{ ...cover, blocks: [] }, page(lead)]);
    await x.run("set_masthead", { title: "Regatta" });
    const o = x.pages[0]!.coverOverlay!;
    ok(
      o.style === "dark" && o.position === DEFAULT_COVER_OVERLAY.position,
      `set_masthead on paper writes dark type at the default position (${o.style}, ${o.position})`,
    );
  }

  heading(
    "cover tools: the masthead keeps its typeface and takes the next order",
  );
  {
    const face = { fontFamily: "hanken-grotesk", fontWeight: 700 } as const;
    const lettered = (text: string, color?: string) => {
      const doc = plainCoverDoc(text);
      doc.content[0]!.content = [
        {
          type: "text",
          text,
          marks: [{ type: "coverPaint", attrs: { ...face, color } }],
        },
      ];
      return doc;
    };
    const masthead = {
      ...makeBlock("heading"),
      title: "Old name",
      kicker: "The club magazine",
      coverPlacement: {
        ...makeCoverElement("details").placement,
        order: 3,
        richText: {
          title: lettered("Old name", "#ff0000"),
          kicker: lettered("The club magazine"),
        },
      },
    } as Block;
    const x = harness([{ ...cover, blocks: [masthead] }, page(lead)]);
    await x.run("set_masthead", { title: "Summer Regatta" });
    const kept = x.pages[0]!.blocks[0]! as Extract<Block, { type: "heading" }>;
    const title = kept.coverPlacement?.richText?.title;
    const marks = title?.content[0]?.content?.[0];
    ok(
      marks?.type === "text" &&
        marks.text === "Summer Regatta" &&
        JSON.stringify(marks.marks) ===
          JSON.stringify([{ type: "coverPaint", attrs: face }]) &&
        JSON.stringify(kept.coverPlacement?.richText?.kicker) ===
          JSON.stringify(lettered("The club magazine")),
      "new words keep the face and weight, not the colour; the kicker is untouched",
    );
    const style = await x.run("style_cover_item", {
      id: masthead.id,
      text: "ink",
    });
    ok(
      style.text.includes("their own colour") === false,
      "with no per-word colour left, styling just says so",
    );
    const y = harness([
      { ...cover, blocks: [{ ...masthead, title: "Old name" } as Block] },
      page(lead),
    ]);
    const coloured = await y.run("style_cover_item", {
      id: masthead.id,
      text: "ink",
    });
    ok(
      coloured.text.includes("have their own colour"),
      `words coloured one by one are reported as keeping it (${coloured.text.split(".")[0]})`,
    );
    const z = harness([{ ...cover, blocks: [] }, page(lead)]);
    await z.run("add_details", { text: "Spring" });
    await z.run("set_masthead", { title: "Regatta" });
    const head = z.pages[0]!.blocks.find((b) => b.type === "heading")!;
    ok(
      "coverPlacement" in head && (head.coverPlacement?.order ?? 0) > 0,
      "a new masthead takes the next order, after what's there",
    );
  }

  heading("cover tools: placing counts as a move for the breaker");
  {
    const x = harness([{ ...cover, blocks: [] }, page(lead)]);
    x.executor.beginRun();
    await x.run("add_details", { text: "Spring" });
    const id = x.pages[0]!.coverElements![0]!.id;
    const place = (column: string) =>
      x.run("place_cover_item", {
        id,
        column,
        row: "top",
        width: "narrow",
        align: "left",
      });
    for (const column of ["left", "right"].slice(0, RUN_MOVE_LIMIT))
      await place(column);
    const early = x.executor.breaker();
    await place("center");
    ok(
      early === null && x.executor.breaker() !== null,
      `placing the same item a ${RUN_MOVE_LIMIT + 1}rd time trips the breaker`,
    );
  }

  heading("cover tools: one cover a run; a selected cover item stays selected");
  {
    const back = { ...cover, id: "back-cover", blocks: [] } as Page;
    const x = harness([{ ...cover, blocks: [] }, page(lead), back]);
    x.set({ pages: x.pages, curPage: 0, sel: null });
    x.executor.beginRun();
    await x.run("add_details", { text: "Spring" });
    const story = x.pages[0]!.coverElements![0]!.id;
    x.set({ pages: x.pages, curPage: 2, sel: story });
    const second = await x.run("add_logo", { logo: "club burgee" });
    ok(
      second.text.includes("The cover (page 1)") &&
        !x.pages[2]!.coverElements?.length,
      "turning to the back cover mid-run leaves the run on the front one",
    );
    ok(
      x.sel === story,
      "the selected cover item is still selected after the edit",
    );
    x.executor.beginRun();
    const next = await x.run("add_details", { text: "Autumn" });
    ok(
      next.text.includes("The cover (page 3)"),
      "a new run takes the cover open now",
    );
  }

  heading("cover tools: clearing a background says where the photo is");
  {
    const [shot] = [...photos];
    const x = harness([{ ...cover, blocks: [] }, page(lead)]);
    await x.run("set_cover_background", { imageId: shot, fit: "fill" });
    const alone = await x.run("clear_cover_background", {});
    await x.run("set_cover_background", { imageId: shot, fit: "fill" });
    const pic = { ...makeBlock("image"), imageId: shot } as Block;
    x.set({
      pages: [x.pages[0]!, page(lead, pic)],
      curPage: 0,
      sel: null,
    });
    const shared = await x.run("clear_cover_background", {});
    ok(
      alone.text.includes("unplaced again") &&
        !shared.text.includes("unplaced"),
      "“unplaced again” only when no other page shows it",
    );
  }
}
