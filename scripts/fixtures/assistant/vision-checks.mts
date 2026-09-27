// The vision cases of dev-assistant-tools-gate.mts (#342), on the gate's own
// scratch draft and session: view_photo answers with a picture, the seventh
// view is refused, a run that changed two pages gets exactly one review turn
// carrying both, a one-page run gets none, and an edit made in the review turn
// undoes with the rest of the run in one step; and a Stop while the review's
// pages are pictured, then a new message, sends no stale review.
//
// The draft's photo row names a file nobody wrote; for view_photo this puts a
// copy of a seed photo there, and takes it away again at the end.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page } from "playwright";
import { REVIEW_TEXT } from "../../../src/features/editor/assistant/review.ts";
import {
  block,
  canonical,
  ids,
  until,
  where,
  type Doc,
} from "./tools-gate-kit.mts";

type Call = { toolName: string; input: object } | null;
type Part = {
  type: string;
  text?: string;
  toolCallId?: string;
  output?: { text: string; images?: { mediaType: string }[] };
};
type Body = { runId: string; messages: { role: string; parts: Part[] }[] };

export async function visionChecks(
  page: Page,
  {
    photoId,
    photoKey,
    saved,
    runScript,
    ok,
    heading,
  }: {
    photoId: string;
    photoKey: string;
    saved: () => Promise<Doc>;
    runScript: (page: Page, calls: Call[]) => Promise<unknown>;
    ok: (cond: unknown, msg: string) => void;
    heading: (name: string) => void;
  },
) {
  if (!/^[\w-]+\/photo\.webp$/.test(photoKey))
    throw new Error(`refusing to write ${photoKey}`);
  const file = join(process.cwd(), ".data/uploads", photoKey);
  await mkdir(dirname(file), { recursive: true });
  await copyFile(join(process.cwd(), ".data/uploads/seed/gravel.webp"), file);

  // Every tool output with its pictures, and every review the panel sent.
  const outputs = new Map<string, NonNullable<Part["output"]>>();
  const reviews: { runId: string; parts: Part[] }[] = [];
  const reviewed = new Set<string>();
  page.on("request", (req) => {
    if (!req.url().endsWith("/api/admin/ai/chat")) return;
    const body = req.postDataJSON() as Body;
    for (const m of body.messages)
      for (const p of m.parts)
        if (p.toolCallId && p.output) outputs.set(p.toolCallId, p.output);
    const last = body.messages.at(-1);
    const key = JSON.stringify(last?.parts.slice(1));
    if (last?.parts[0]?.text === REVIEW_TEXT && !reviewed.has(key)) {
      reviewed.add(key);
      reviews.push({ runId: body.runId, parts: last.parts });
    }
  });
  const newest = (n: number) => [...outputs.values()].slice(-n);

  try {
    // A fresh conversation: the gate's earlier runs fill the history, and
    // pictures count against the route's per-conversation cap.
    const restart = page.locator('button[aria-label="New conversation"]');
    if (await restart.isVisible()) await restart.click();

    heading("view_photo answers with a picture");
    await runScript(page, [
      { toolName: "view_photo", input: { imageId: photoId } },
    ]);
    const [photo] = newest(1);
    ok(
      photo?.images?.length === 1 &&
        photo.images[0]!.mediaType === "image/jpeg" &&
        photo.text.startsWith(`Photo ${photoId} (`),
      `the photo came back as one JPEG: "${photo?.text}"`,
    );

    heading("six views a run, the seventh refused");
    await runScript(page, [
      ...Array.from({ length: 6 }, () => ({
        toolName: "view_page",
        input: { page: 2 },
      })),
      { toolName: "view_photo", input: { imageId: photoId } },
    ]);
    const seven = newest(7);
    ok(
      seven.slice(0, 6).every((o) => o.images?.length === 1) &&
        /^Page 2 \((fits|overflows)/.test(seven[0]!.text),
      `six pictures of page 2: "${seven[0]?.text}"`,
    );
    ok(
      seven[6]?.text.startsWith("Error: you have used all 6 views") &&
        !seven[6].images,
      "the seventh view is refused, with no picture",
    );

    heading("a two-page run: one review turn with both pages");
    // The breaker checks leave `next` beside `intro` on page 2: back to page 3,
    // a one-page move, so the edits below touch two pages.
    await runScript(page, [
      {
        toolName: "move_block",
        input: { blockId: ids.next, after: { page: 3 } },
      },
    ]);
    await until(
      "next back on page 3",
      async () => where(await saved(), ids.next) === 3,
    );
    const before = reviews.length;
    await runScript(page, [
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "Vision, page two." },
      },
      {
        toolName: "set_heading",
        input: { blockId: ids.next, title: "Seen again", level: "section" },
      },
    ]);
    const review = reviews.slice(before);
    const pictures = review[0]?.parts.filter((p) => p.type === "file") ?? [];
    const captions = review[0]?.parts
      .slice(1)
      .flatMap((p) => (p.type === "text" ? [p.text] : []));
    ok(
      review.length === 1 &&
        pictures.length === 2 &&
        /^Page 2 \(/.test(captions?.[0] ?? "") &&
        /^Page 3 \(/.test(captions?.[1] ?? ""),
      `exactly one review, pages ${captions?.join(" · ")}`,
    );

    heading("a one-page run: no review");
    const quiet = reviews.length;
    await runScript(page, [
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "Vision, one page only." },
      },
    ]);
    ok(reviews.length === quiet, "no review after a single-page edit");

    heading("the review's edit undoes with the run");
    // From the one-page run's saved state, not a save still on its way.
    await until("autosave of the one-page run", async () =>
      JSON.stringify(block(await saved(), ids.intro)).includes("one page only"),
    );
    const start = await saved();
    await runScript(page, [
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "Before the review." },
      },
      {
        toolName: "set_heading",
        input: { blockId: ids.next, title: "Reviewed", level: "section" },
      },
      null,
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "Fixed in the review." },
      },
    ]);
    await until("autosave of the review's edit", async () =>
      JSON.stringify(block(await saved(), ids.intro)).includes(
        "Fixed in the review.",
      ),
    );
    ok(reviews.length === quiet + 1, "the run had its one review");
    await page.click("body", { position: { x: 5, y: 5 } }).catch(() => {});
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await page.keyboard.press("Control+z");
    await until("autosave of the undo", async () => {
      const now = await saved();
      return (
        canonical(block(now, ids.intro)) === canonical(block(start, ids.intro))
      );
    });
    const undone = await saved();
    ok(
      canonical(block(undone, ids.next)) === canonical(block(start, ids.next)),
      "one Ctrl+Z took back both the run's edits and the review's",
    );

    heading(
      "Stop while picturing, then a new message: the old review is dropped",
    );
    const runIds: string[] = [];
    let reviewPosts = 0;
    page.on("request", (req) => {
      if (!req.url().endsWith("/api/admin/ai/chat")) return;
      const body = req.postDataJSON() as Body;
      runIds.push(body.runId);
      if (body.messages.at(-1)?.parts[0]?.text === REVIEW_TEXT) reviewPosts++;
    });
    await page.fill(
      "#assistant-input",
      `Please [fake:tools]${JSON.stringify([
        {
          toolName: "set_text",
          input: { blockId: ids.intro, markdown: "Raced." },
        },
        {
          toolName: "set_heading",
          input: { blockId: ids.next, title: "Raced", level: "section" },
        },
      ])}`,
    );
    await page.keyboard.press("Enter");
    await page.waitForSelector("text=Picturing the pages it changed…", {
      timeout: 30_000,
    });
    await page.click('button[aria-label="Stop the reply"]');
    const firstRun = runIds.at(-1);
    await page.fill("#assistant-input", "Which pages are nearly full?");
    await page.keyboard.press("Enter");
    const log = '[role="log"]';
    await page.waitForFunction(
      (sel) =>
        document.querySelector(sel)?.getAttribute("aria-busy") === "false",
      log,
      { timeout: 30_000 },
    );
    // Long enough for the stopped run's render to have finished.
    await page.waitForTimeout(4000);
    const secondRun = runIds.at(-1);
    ok(reviewPosts === 0, "no review was sent after the Stop");
    ok(
      firstRun !== secondRun &&
        runIds
          .slice(runIds.indexOf(secondRun!))
          .every((id) => id === secondRun),
      `the new run's requests are all its own (${runIds.length - runIds.indexOf(secondRun!)})`,
    );
  } finally {
    await rm(dirname(file), { recursive: true, force: true });
  }
}
