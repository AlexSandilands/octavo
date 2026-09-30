// set_text's guard (seen-text.ts), for check-ai-runs.mts: a block the view cut
// short is rewritten only once the model has had it whole. read_page is the
// real one here, over the harness's pages, so the guard is checked against
// what a page view actually prints.
import type { Page } from "../../../src/lib/blocks";
import type { AssistantIssue } from "../../../src/features/editor/assistant/issue-context";
import {
  READ_TEXT_CAP,
  VIEW_TEXT_CAP,
  textMarkdown,
} from "../../../src/features/editor/assistant/projection";
import { readPage } from "../../../src/features/editor/assistant/tools";
import * as h from "./tools-harness.mts";

const { ok, heading, call, harness, cover, page } = h;

const issueOf = (pages: Page[]): AssistantIssue => ({
  title: "Spring",
  theme: "classic",
  pages,
  images: {},
  uploads: [],
  logos: [],
  sponsorNames: [],
  fills: {},
});

/** A paragraph of `chars` characters, in lines of 1,000 (a run holds 8,000). */
const lines = (chars: number) => ({
  type: "paragraph" as const,
  content: Array.from({ length: Math.ceil(chars / 1_000) }, (_, i) => [
    ...(i ? [{ type: "hardBreak" as const }] : []),
    {
      type: "text" as const,
      text: "word ".repeat(Math.min(1_000, chars - i * 1_000) / 5).trim(),
    },
  ]).flat(),
});

/** A text block of `paras` paragraphs, about `chars` characters in all. */
const long = (chars: number, paras = 1): h.TextBlock => ({
  ...h.textBlock(1),
  text: {
    type: "doc",
    content: Array.from({ length: paras }, () => lines(chars / paras)),
  },
});

/** The harness, with each call made in one of the model's replies. */
function replies(pages: Page[]) {
  const x = harness(pages);
  x.executor.beginRun();
  const run = (reply: number, name: string, input: unknown) =>
    x.executor.run(name, input, {
      ...call,
      reply,
      read: (args) => readPage(args, issueOf(x.pages)),
    });
  return { x, run };
}

const refused = (out: { text: string }, ...words: string[]) =>
  out.text.startsWith("Error:") && words.every((w) => out.text.includes(w));
const text = (x: { pages: Page[] }, id: string) =>
  x.pages.flatMap((p) => p.blocks).find((b) => b.id === id) as h.TextBlock;

export async function seenTextChecks() {
  heading("set_text needs a long block seen whole first");
  {
    const a = long(VIEW_TEXT_CAP + 500);
    const { x, run } = replies([cover, page(a)]);
    const blind = await run(0, "set_text", { blockId: a.id, markdown: "Cut." });
    ok(
      refused(blind, "read_page for page 2") &&
        x.history.length === 0 &&
        x.pages[1]!.blocks[0] === a,
      "refused before a read: nothing changes",
    );
    const read = await run(1, "read_page", { page: 2 });
    ok(
      read.text.includes(textMarkdown(a).slice(-40)) &&
        !read.text.includes("[…]"),
      "read_page prints the block to its end",
    );
    const beside = await run(1, "set_text", { blockId: a.id, markdown: "x" });
    ok(
      refused(beside, "before read_page answered") && x.history.length === 0,
      "a rewrite made in the same reply as its read_page is refused",
    );
    const after = await run(2, "set_text", {
      blockId: a.id,
      markdown: "word ".repeat(VIEW_TEXT_CAP / 4),
    });
    ok(!after.text.startsWith("Error:"), "in the next reply it goes through");
    const again = await run(2, "set_text", { blockId: a.id, markdown: "Cut." });
    ok(
      !again.text.startsWith("Error:"),
      "its own long rewrite needs no fresh read",
    );
  }

  heading("set_text: what the run wrote, and what a new run forgets");
  {
    const a = long(VIEW_TEXT_CAP + 500);
    const { x, run } = replies([cover, page(a), page()]);
    const markdown = "word ".repeat(VIEW_TEXT_CAP / 4);
    await run(0, "insert_blocks", {
      after: { page: 3 },
      blocks: [{ kind: "text", markdown }],
    });
    const mine = x.pages[2]!.blocks[0]!;
    const own = await run(0, "set_text", { blockId: mine.id, markdown });
    ok(
      !own.text.startsWith("Error:"),
      "a long block it inserted itself needs no read",
    );
    await run(0, "read_page", { page: 2 });
    x.executor.beginRun();
    const stale = await run(1, "set_text", { blockId: a.id, markdown: "x" });
    ok(
      refused(stale, "read_page for page 2") && text(x, a.id) === a,
      "a new run has seen nothing: last run's read doesn't count",
    );
    const next = await run(1, "set_text", { blockId: mine.id, markdown: "x" });
    ok(
      refused(next, "read_page for page 3"),
      "nor does what the last one wrote",
    );
  }

  heading("set_text: the parts of a split are read before they are rewritten");
  {
    // 30 paragraphs on a 20-paragraph page: the split keeps 20, carries 10.
    const a = long(6_000, 30);
    const { x, run } = replies([cover, page(a)]);
    await run(0, "read_page", { page: 2 });
    const split = await run(1, "split_page", { page: 2 });
    const kept = text(x, a.id);
    ok(
      split.text.startsWith("Moved") &&
        textMarkdown(kept).length > VIEW_TEXT_CAP,
      "split_page leaves a part past the view's cut",
    );
    const part = await run(1, "set_text", { blockId: a.id, markdown: "x" });
    ok(
      refused(part, "read_page for page 2") && text(x, a.id) === kept,
      "the part is new text: the read of the whole doesn't count for it",
    );
    await run(2, "read_page", { page: 2 });
    const done = await run(3, "set_text", { blockId: a.id, markdown: "x" });
    ok(!done.text.startsWith("Error:"), "read, then rewritten");
  }

  heading("set_text: a block no read_page can show names a step that can work");
  {
    const many = long(READ_TEXT_CAP + 500, 30);
    const one = long(READ_TEXT_CAP + 500);
    const { x, run } = replies([cover, page(many), page(one)]);
    await run(0, "read_page", { page: 2 });
    await run(0, "read_page", { page: 3 });
    const split = await run(1, "set_text", { blockId: many.id, markdown: "x" });
    ok(
      refused(split, "split_page on page 2", "read_page the new pages"),
      "several paragraphs past read_page's cut: split, then read the parts",
    );
    const stuck = await run(1, "set_text", { blockId: one.id, markdown: "x" });
    ok(
      refused(stuck, "split_page can't divide it", "tell the author") &&
        !stuck.text.includes("split_page on page") &&
        x.history.length === 0,
      "one paragraph past it: no tool is named, the author is",
    );

    // Six blocks of 11,000: read_page has room for five.
    const blocks = Array.from({ length: 6 }, () => long(11_000));
    const full = replies([cover, page(...blocks)]);
    const view = await full.run(0, "read_page", { page: 2 });
    ok(
      view.text.includes(`[${blocks[4]!.id}]`) &&
        !view.text.includes(`[${blocks[5]!.id}]`) &&
        view.text.includes("[…] 1 more block not shown"),
      "a page past read_page's room stops at a block, and says so",
    );
    const hidden = await full.run(1, "set_text", {
      blockId: blocks[5]!.id,
      markdown: "x",
    });
    const shown = await full.run(1, "set_text", {
      blockId: blocks[0]!.id,
      markdown: "x",
    });
    ok(
      refused(hidden, "page 2 is too long for read_page", "split_page") &&
        !shown.text.startsWith("Error:"),
      "the block it left out asks for room; one it printed is rewritten",
    );
  }

  heading("set_text: a cover's text is the cover tools' to refuse");
  {
    const a = long(VIEW_TEXT_CAP + 500);
    const { run } = replies([{ ...cover, blocks: [a] }, page()]);
    const out = await run(0, "set_text", { blockId: a.id, markdown: "x" });
    ok(refused(out, "page 1 is a cover"), "the cover refusal, not a read_page");
  }
}
