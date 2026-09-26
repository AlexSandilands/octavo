// The cover half of dev-assistant-tools-gate.mts (#313): a copy of the Regatta
// seed issue with its cover emptied, composed by a scripted fake-provider run
// from the cover's Compose preset's place in the panel — background, masthead,
// a story linking three real headings, details, the club's logo, two items
// placed and styled. The run is one step (the panel's Undo empties the cover,
// Ctrl+Y puts it back), Ask ends a cover item's bar (a logo's bar of its own),
// and once published
// the composed cover renders in both readers, the print route and the library
// thumbnail. Its own tab and chat watch; its own scratch issue, deleted after.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type postgres from "postgres";
import { watchChat, until } from "./fixtures/assistant/tools-gate-kit.mts";

type Doc = {
  pages: {
    id: string;
    cover?: boolean;
    blocks: { id: string; type: string; title?: string; imageId?: string }[];
    coverElements?: { id: string; type: string }[];
  }[];
};
const RUN = "[data-assistant-run]";
const LOGO = "Regatta · sailing club burgee";

export async function checkCover(d: {
  page: Page;
  sql: postgres.Sql;
  base: string;
  tag: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
  /** An optional folder for screenshots of the cover's Ask. */
  shots?: string;
}) {
  const { sql, base, ok, heading } = d;
  const [seed] = await sql<{ content: Doc; theme: string }[]>`
    select content, theme from issues
    where content::text like '%seed-regatta-logo%' and status = 'published'
    order by number limit 1`;
  assert(seed, "the Regatta seed issue is in the database");
  const id = crypto.randomUUID();
  const coverId = crypto.randomUUID();
  const pages = [
    { id: coverId, cover: true, blocks: [] },
    ...seed.content.pages.slice(1),
  ];
  const heads = pages
    .slice(1)
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "heading" && b.title?.trim())
    .slice(0, 3);
  const shot = pages
    .slice(1)
    .flatMap((p) => p.blocks)
    .find((b) => b.type === "image" && b.imageId)?.imageId;
  assert(heads.length === 3 && shot, "three headings and a photo to use");
  await sql`insert into issues (id, title, theme, status, content) values
    (${id}, ${`${d.tag}-cover`}, ${seed.theme}, 'draft',
     ${sql.json({ ...seed.content, pages } as never)})`;
  const saved = async () =>
    (
      await sql<{ content: Doc }[]>`select content from issues where id = ${id}`
    )[0]!.content;
  const tab = await d.page.context().newPage();
  try {
    heading("cover: composed by a run, one step");
    const chat = watchChat(tab);
    await tab.goto(`${base}/admin/issues/${id}/edit`);
    await tab.click(
      'nav[aria-label="Editor panels"] button[aria-label="Assistant"]',
    );
    await tab.waitForSelector("#assistant-input");
    ok(
      (await tab.$('button:text-is("Compose cover")')) !== null &&
        (await tab.$('button:text-is("Tidy this page")')) === null,
      "on a cover the panel offers Compose cover, not the page presets",
    );
    const run = await chat.runScript(
      [
        {
          toolName: "set_cover_background",
          input: { imageId: shot, fit: "fill" },
        },
        {
          toolName: "set_masthead",
          input: { title: "Regatta", kicker: "The season review" },
        },
        {
          toolName: "add_story",
          input: {
            items: heads.map((h, i) =>
              i
                ? { headingId: h.id }
                : { headingId: h.id, title: "Racing at dusk" },
            ),
            headlineSize: "large",
          },
        },
        { toolName: "add_details", input: { text: "Autumn 2026" } },
        { toolName: "add_logo", input: { logo: LOGO, size: 90 } },
        {
          toolName: "style_cover_page",
          input: { text: "paper", shadow: "soft" },
        },
      ],
      "Compose the cover",
    );
    ok(
      run.outputs.length === 6 &&
        run.outputs.every((o) => !o.startsWith("Error")),
      `all six calls applied (${run.outputs.map((o) => o.split(".")[0]).join("; ")})`,
    );
    ok(
      run.outputs
        .at(-1)
        ?.includes(
          "The cover (page 1) now has a background photo, a masthead, 1 story, issue details, 1 logo.",
        ),
      "the results end with what the cover holds",
    );
    await until("autosave of the cover", async () =>
      Boolean((await saved()).pages[0]!.coverElements?.length === 3),
    );
    const composed = (await saved()).pages[0]!;
    const [story, details, logo] = composed.coverElements!;
    const place = await chat.runScript([
      {
        toolName: "place_cover_item",
        input: {
          id: story!.id,
          column: "left",
          row: "bottom",
          width: "medium",
          align: "left",
        },
      },
      {
        toolName: "style_cover_item",
        input: { id: story!.id, panel: true, background: "ink" },
      },
      {
        toolName: "place_cover_item",
        input: {
          id: details!.id,
          column: "right",
          row: "top",
          width: "narrow",
          align: "right",
        },
      },
      {
        toolName: "style_cover_item",
        input: { id: details!.id, shadow: "strong" },
      },
    ]);
    ok(
      place.outputs.every((o) => !o.startsWith("Error")),
      "two items placed and styled",
    );
    const line = (await tab.textContent(RUN))?.trim();
    ok(
      /^Changed \d+ blocks? on page 1\s*Undo$/.test(line ?? ""),
      `the run's line (${line})`,
    );
    const masthead = composed.blocks.find((b) => b.type === "heading")!;
    await checkCoverAsk(tab, story!.id, logo!.id, masthead.id, ok, d.shots);

    heading("cover: one Undo, and back");
    // The placing run is its own step: Undo it, then the compose run.
    await tab.click(`${RUN} button:text-is("Undo")`);
    await tab.keyboard.press("Escape");
    await tab.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await tab.keyboard.press("Control+z");
    await until("autosave of the undo", async () => {
      const c = (await saved()).pages[0]!;
      return !c.coverElements?.length && c.blocks.length === 0;
    });
    ok(true, "Undo emptied the cover again, a run a step");
    await tab.keyboard.press("Control+y");
    await tab.keyboard.press("Control+y");
    await until("autosave of the redo", async () => {
      const c = (await saved()).pages[0]!;
      return c.coverElements?.length === 3 && c.blocks.length === 2;
    });
    ok(true, "Ctrl+Y put both runs back");

    heading("cover: both readers, print and the thumbnail");
    await tab.goto(`${base}/admin`); // unmount autosave before publishing
    const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`
      select coalesce(max(number), 0) + 1000 as n from issues`;
    await sql`update issues set status = 'published', number = ${n},
      published_at = now() where id = ${id}`;
    const words = ["Regatta", "Racing at dusk", "Autumn 2026"];
    const shows = async (frame: ReturnType<Page["locator"]>, what: string) => {
      await frame.locator("[data-cover-entry]").first().waitFor();
      const text = (await frame.innerText()).toLowerCase();
      const entries = await frame.locator("[data-cover-entry]").count();
      const logos = await frame.locator(".cover-logo img").count();
      const missing = words.filter((w) => !text.includes(w.toLowerCase()));
      ok(
        entries === 4 && !missing.length && logos === 1,
        `${what}: masthead, story, details and logo (${entries} items, ${logos} logo${missing.length ? `, missing ${missing.join(", ")}` : ""})`,
      );
    };
    await tab.setViewportSize({ width: 1440, height: 1000 });
    await tab.goto(`${base}/read/${n}`);
    await shows(
      tab.locator("[data-page-frame]:visible").first(),
      "the desktop reader",
    );
    await tab.setViewportSize({ width: 390, height: 844 });
    await tab.goto(`${base}/read/${n}`);
    await shows(
      tab.locator("section.cover-composition").first(),
      "the phone reader",
    );
    const token = createHash("sha256")
      .update(`${process.env.AUTH_SECRET}:pdf-print`)
      .digest("hex");
    await tab.setViewportSize({ width: 1440, height: 1000 });
    await tab.goto(`${base}/read/${n}/print?token=${token}`, {
      waitUntil: "networkidle",
    });
    await shows(tab.locator("[data-page-frame]").first(), "the print route");
    await tab.goto(base);
    await shows(
      tab
        .locator(`a[href="/read/${n}"]`)
        .filter({ has: tab.locator("[data-page-frame]") })
        .first(),
      "the library thumbnail",
    );
  } finally {
    await tab.close();
    await sql`delete from ai_usage where issue_id = ${id}`;
    await sql`delete from issues where id = ${id}`;
  }
}

/** Ask ends a story's and the masthead's format bars; a logo's bar is just Ask. */
async function checkCoverAsk(
  tab: Page,
  storyId: string,
  logoId: string,
  mastheadId: string,
  ok: (cond: unknown, msg: string) => void,
  shots?: string,
) {
  const shoot = (name: string) =>
    shots ? tab.screenshot({ path: `${shots}/${name}.png` }) : null;
  const item = (id: string) => `[data-cover-element="${id}"]`;
  await tab.click(`${item(storyId)} [role="button"]`);
  const inBar = `${item(storyId)} [data-block-bar] > div:not(.overflow-x-auto) > [data-ask]`;
  ok(
    await tab.waitForSelector(inBar, { timeout: 5000 }).catch(() => null),
    "a selected story has Ask at the end of its format bar, outside the scrolling row",
  );
  await tab.click(`${inBar} button[aria-label="Ask"]`);
  const box = await tab
    .locator(`${item(storyId)} [role="dialog"]`)
    .boundingBox();
  const width = tab.viewportSize()!.width;
  ok(
    box && box.x >= 0 && box.x + box.width <= width,
    `its box opens inside the window (${Math.round(box?.x ?? -1)}–${Math.round((box?.x ?? 0) + (box?.width ?? 0))} of ${width})`,
  );
  await shoot("cover-ask-story");
  await tab.keyboard.press("Escape");
  await tab.click(`${item(logoId)} [role="button"]`);
  const bar = tab.locator(`${item(logoId)} [data-block-bar]`);
  ok(
    (await bar.count()) === 1 &&
      (await bar.locator("[data-ask]").count()) === 1 &&
      (await bar.locator("button").count()) === 1,
    "a selected logo has a bar of its own holding just Ask",
  );
  await shoot("cover-ask-logo");
  const head = `[data-block-id="${mastheadId}"]`;
  await tab.click(head);
  ok(
    await tab
      .waitForSelector(
        `${head} [data-block-bar] > div:not(.overflow-x-auto) > [data-ask]`,
        { timeout: 5000 },
      )
      .catch(() => null),
    "the selected masthead has Ask at the end of its format bar",
  );
}
