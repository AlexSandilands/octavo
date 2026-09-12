// Dev-only: proves the owner's running-head switch (issue #269) headless
// against a running dev server.
//
// The switch hides the textual running head the classic theme prints above the
// page content ("THE MAGAZINE · NO. 6") and nothing else. So for each of the
// surfaces that draw a page — the admin preview, the editor canvas (cover and
// interior), the library thumbnail, the desktop reader (cover and an interior
// spread) and the print route in both themes — this surveys four counts:
// `[data-page-masthead]`, the two classic frame rules and `[data-page-decoration]`.
// Switching the setting off must zero the first and leave the other three
// exactly as they were; switching it back on must restore all four.
//
// It also checks the untouched default (a NULL column) renders the same as an
// explicit `true`, that the live preview follows the unsaved form state, that
// the modern theme is unaffected, and that the PDF cache re-keys — read from
// the print route's `print-chrome` stamp, which is `chromeFingerprint()`.
//
// It mints its own scratch admin + session + published issue, and puts the
// `settings` row back the way it found it (including removing a row it had to
// create), so it never disturbs existing content.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-running-head-gate.mts <base-url>
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Locator, type Page } from "playwright";
import type { IssueContent } from "../src/lib/blocks";

const base = process.argv[2] ?? "http://localhost:3269";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
for (const file of [".env", ".env.local"])
  if (existsSync(file)) process.loadEnvFile(file);

const sql = postgres(process.env.DATABASE_URL!);
const printToken = createHash("sha256")
  .update(`${process.env.AUTH_SECRET}:pdf-print`)
  .digest("hex");

const TOGGLE = "Show magazine name and issue number at the top of pages";
const id = crypto.randomUUID();
const userId = crypto.randomUUID();
const token = crypto.randomUUID();

const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

/** Poll a browser probe rather than race the editor's and reader's animations. */
async function waitFor(probe: () => Promise<boolean>, what: string) {
  for (let i = 0; i < 60; i++) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The preview's own theme picker — a per-issue choice offered here so the
 *  owner can look at either treatment. */
async function pickTheme(page: Page, name: string) {
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page
    .getByRole("menu", { name: "Preview layout theme" })
    .getByRole("menuitemradio", { name })
    .click();
}

/** What a page surface is drawing: the running head, and the chrome around it
 *  that must not move when the running head goes. */
type Survey = {
  masthead: number;
  frame: number;
  frameSoft: number;
  decoration: number;
};

async function survey(scope: Page | Locator): Promise<Survey> {
  const count = (selector: string) => scope.locator(selector).count();
  return {
    masthead: await count("[data-page-masthead]"),
    frame: await count(".border-page-frame"),
    frameSoft: await count(".border-page-frame-soft"),
    decoration: await count("[data-page-decoration]"),
  };
}

const content: IssueContent = {
  version: 7,
  pages: [
    {
      id: "cover",
      cover: true,
      blocks: [
        {
          id: "cover-title",
          type: "heading",
          title: "Running Head Check",
          kicker: "The Members’ Magazine",
        },
      ],
    },
    {
      id: "page-two",
      blocks: [
        {
          id: "history",
          type: "heading",
          title: "Our earliest days",
          kicker: "History",
        },
        { id: "history-text", type: "text", text: "From the club archive." },
      ],
    },
    {
      id: "page-three",
      blocks: [
        { id: "tactics", type: "heading", title: "A better game", kicker: "" },
        { id: "tactics-text", type: "text", text: "Notes from the season." },
      ],
    },
  ],
};

const [priorRow] = await sql<
  { showRunningHead: boolean | null }[]
>`select show_running_head as "showRunningHead" from settings where id = 1`;

/** The stored column, straight in — NULL is the untouched deployment. */
const store = (value: boolean | null) =>
  sql`insert into settings (id, show_running_head) values (1, ${value})
      on conflict (id) do update
        set show_running_head = ${value}, updated_at = now()`;

await sql`insert into users (id, email, is_admin, subscribed, email_verified)
          values (${userId}, ${`running-head-269-${userId.slice(0, 8)}@example.invalid`},
                  true, false, now())`;
await sql`insert into sessions (session_token, user_id, expires)
          values (${token}, ${userId}, now() + interval '1 hour')`;
const [issue] = await sql<{ number: number }[]>`
  insert into issues (id, number, title, theme, status, content, published_at)
  values (${id}, (select coalesce(max(number), 0) + 1 from issues),
          'Running head check', 'classic', 'published', ${sql.json(content)}, now())
  returning number`;
assert(issue, "scratch issue was not created");
const number = issue.number;
console.log(`scratch issue ${id} (no. ${number}), admin session minted`);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  /** Every surface that draws a page, plus the print route's chrome stamp. */
  async function surveyAll() {
    const surveys: Record<string, Survey> = {};

    await page.goto(`${base}/admin/magazine`);
    const preview = page.locator("[data-page-frame]");
    await preview.waitFor();
    surveys["admin preview"] = await survey(preview);

    await page.goto(`${base}/admin/issues/${id}/edit`);
    const canvas = page.locator("[data-page-frame]");
    await canvas.locator('[data-block-id="cover-title"]').waitFor();
    surveys["editor cover"] = await survey(canvas);
    // The rail's page thumbs carry no name of their own; their Delete twin does.
    await page
      .locator("div.group", { has: page.getByLabel("Delete page 2") })
      .locator("button")
      .first()
      .click();
    await waitFor(
      async () =>
        (await canvas.locator('[data-block-id="history"]').count()) === 1,
      "the editor to show page 2",
    );
    surveys["editor interior"] = await survey(canvas);

    await page.goto(base);
    const thumb = page
      .locator(`a[href="/read/${number}"]`)
      .filter({ has: page.locator("[data-page-frame]") })
      .first();
    await thumb.waitFor();
    surveys["library thumbnail"] = await survey(thumb);

    await page.goto(`${base}/read/${number}`);
    const cover = page.locator("[data-page-frame]:visible").first();
    await cover.waitFor();
    surveys["reader cover"] = await survey(cover);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    // The turn renders extra copies of both leaves; the resting spread is two.
    await waitFor(
      async () =>
        (await page.locator("[data-page-frame]").count()) === 2 &&
        (await page
          .locator('[data-page-frame]:has-text("Our earliest days")')
          .count()) === 1,
      "the reader to rest on the first interior spread",
    );
    surveys["reader interior"] = await survey(page);

    let fingerprint = "";
    for (const theme of ["classic", "modern"]) {
      await page.goto(
        `${base}/read/${number}/print?token=${printToken}&theme=${theme}`,
        { waitUntil: "networkidle" },
      );
      surveys[`print ${theme}`] = await survey(page);
      const stamp = await page
        .locator('meta[name="print-chrome"]')
        .getAttribute("content");
      assert(stamp, "the print route stamped no chrome fingerprint");
      if (theme === "classic") fingerprint = stamp;
      else assert.equal(stamp, fingerprint, "the stamp is not theme-dependent");
    }
    return { surveys, fingerprint };
  }

  heading("Shown by default (an untouched deployment: NULL column)");
  await store(null);
  const shown = await surveyAll();
  for (const [surface, s] of Object.entries(shown.surveys)) {
    // Modern draws no textual running head at all; every classic surface must
    // draw one per page it renders.
    const wanted = surface === "print modern" ? 0 : s.frame;
    ok(
      s.masthead === wanted && (wanted > 0 || surface === "print modern"),
      `${surface}: ${s.masthead} running head(s) over ${s.frame} frame + ${s.frameSoft} soft rule(s)`,
    );
  }

  heading("The live preview follows the unsaved form state");
  await page.goto(`${base}/admin/magazine`);
  const preview = page.locator("[data-page-frame]");
  const toggle = page.getByRole("checkbox", { name: TOGGLE });
  await preview.waitFor();
  ok(await toggle.isChecked(), "the switch starts on");
  await toggle.uncheck();
  const unsaved = await survey(preview);
  ok(
    unsaved.masthead === 0,
    "unchecking drops the running head from the preview",
  );
  ok(
    unsaved.frame === shown.surveys["admin preview"]!.frame &&
      unsaved.frameSoft === shown.surveys["admin preview"]!.frameSoft &&
      unsaved.decoration === shown.surveys["admin preview"]!.decoration,
    "both frame rules and the decoration layer stay in the preview",
  );
  const [stillNull] = await sql<
    { showRunningHead: boolean | null }[]
  >`select show_running_head as "showRunningHead" from settings where id = 1`;
  ok(stillNull?.showRunningHead === null, "nothing is stored until Save");

  heading("Modern has no textual running head either way");
  await pickTheme(page, "Modern");
  const modernOff = await survey(preview);
  await toggle.check();
  const modernOn = await survey(preview);
  ok(
    modernOff.masthead === 0 && modernOn.masthead === 0,
    "the modern preview draws no running head with the switch off or on",
  );
  ok(
    modernOn.decoration === 1 && modernOff.decoration === 1,
    "modern keeps its own page decoration throughout",
  );

  heading("Saving it off");
  await pickTheme(page, "Classic");
  await toggle.uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved — live on the site now.").waitFor();
  const [savedRow] = await sql<
    { showRunningHead: boolean | null }[]
  >`select show_running_head as "showRunningHead" from settings where id = 1`;
  ok(
    savedRow?.showRunningHead === false,
    "the column stores the owner's false",
  );

  heading("Off hides only the text, on every surface");
  const hidden = await surveyAll();
  for (const [surface, s] of Object.entries(hidden.surveys)) {
    const was = shown.surveys[surface]!;
    ok(s.masthead === 0, `${surface}: no running head`);
    ok(
      s.frame === was.frame &&
        s.frameSoft === was.frameSoft &&
        s.decoration === was.decoration,
      `${surface}: ${s.frame} frame + ${s.frameSoft} soft rule(s) + ${s.decoration} decoration layer(s), unchanged`,
    );
  }
  ok(
    hidden.fingerprint !== shown.fingerprint,
    `the PDF cache key changes (${shown.fingerprint} → ${hidden.fingerprint})`,
  );

  heading("Switching it back on restores everything");
  await store(true);
  const back = await surveyAll();
  for (const [surface, s] of Object.entries(back.surveys)) {
    assert.deepEqual(s, shown.surveys[surface], `${surface} did not come back`);
  }
  ok(true, "every surface matches the default render again");
  ok(
    back.fingerprint === shown.fingerprint,
    `an explicit true keys the same as the NULL default (${back.fingerprint})`,
  );

  await ctx.close();
  console.log(
    "\nPASS — the running-head switch hides the text and nothing else",
  );
} finally {
  await browser.close();
  if (priorRow) {
    await sql`update settings set show_running_head = ${priorRow.showRunningHead}
              where id = 1`;
  } else {
    await sql`delete from settings where id = 1`;
  }
  await sql`delete from issues where id = ${id}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  console.log("scratch rows removed, settings row restored");
  await sql.end();
}
