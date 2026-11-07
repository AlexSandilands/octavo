// A tall block moved with the keyboard steps one block per press, down and up,
// past short ones (#55). Usage: tsx scripts/check-list-keyboard-drag-browser.mts [base]
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import type { IssueContent } from "../src/lib/blocks";
import { hashSessionToken } from "../src/lib/session-token";

const base = process.argv[2] ?? "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
for (const env of [".env", ".env.local"])
  if (existsSync(env)) process.loadEnvFile(env);
const sql = postgres(process.env.DATABASE_URL!);
const id = crypto.randomUUID(),
  userId = crypto.randomUUID(),
  token = crypto.randomUUID();
const [photo] = await sql<
  { id: string }[]
>`select id from images where key like 'seed/%' order by key limit 1`;
assert(photo, "local seed image required");
const short = ["one", "two", "three", "four"];
const content: IssueContent = {
  version: 6,
  pages: [
    { id: "cover", cover: true, blocks: [] },
    {
      id: "list",
      blocks: [
        {
          id: "tall",
          type: "image",
          imageId: photo.id,
          align: "full",
          width: 100,
          caption: "",
        },
        ...short.map((s) => ({
          id: s,
          type: "text" as const,
          text: `Short ${s}.`,
        })),
      ],
    },
    {
      id: "small",
      blocks: short.map((s) => ({
        id: `s-${s}`,
        type: "text" as const,
        text: `Short ${s}.`,
      })),
    },
  ],
};
await sql`insert into users (id,email,is_admin,subscribed,email_verified) values (${userId},${`keyboard-drag-${userId}@example.invalid`},true,false,now())`;
await sql`insert into sessions (session_token,user_id,expires) values (${hashSessionToken(token)},${userId},now()+interval '1 hour')`;
await sql`insert into issues (id,number,title,theme,status,content) values (${id},null,'Keyboard drag check','classic','draft',${sql.json(content)})`;
const browser = await chromium.launch();
const order = async (pageId: string) => {
  const [row] = await sql<
    { content: IssueContent }[]
  >`select content from issues where id=${id}`;
  return row!.content.pages
    .find((p) => p.id === pageId)!
    .blocks.map((b) => b.id);
};
const waitOrder = async (pageId: string, want: string[]) => {
  for (let i = 0; i < 100; i++) {
    if ((await order(pageId)).join() === want.join()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.deepEqual(await order(pageId), want);
};
const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Lift the block, press each key (two frames apart), then drop or cancel.
  const move = async (blockId: string, keys: string[], end = "Space") => {
    await page
      .locator(`[data-block-id="${blockId}"]`)
      .getByRole("button", { name: "Drag to reorder", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() =>
      document.querySelector(
        '[aria-roledescription="sortable"][aria-pressed="true"]',
      ),
    );
    await frames(page);
    for (const key of keys) {
      await page.keyboard.press(key);
      await frames(page);
    }
    await page.keyboard.press(end);
    await frames(page);
  };
  await page.goto(`${base}/admin/issues/${id}/edit`);
  await page
    .getByRole("button", { name: /Page 2/ })
    .first()
    .click();
  await page.locator('[data-block-id="tall"]').waitFor();
  await move("tall", ["ArrowDown", "ArrowDown"]);
  await waitOrder("list", ["one", "two", "tall", "three", "four"]);
  await move("tall", ["ArrowDown", "ArrowDown", "ArrowDown"]);
  await waitOrder("list", ["one", "two", "three", "four", "tall"]);
  await move("tall", ["ArrowUp", "ArrowUp", "ArrowUp"]);
  await waitOrder("list", ["one", "tall", "two", "three", "four"]);
  await move("tall", ["ArrowUp", "ArrowUp"]);
  await waitOrder("list", ["tall", "one", "two", "three", "four"]);
  // Down, back up over its own slot, then one more: a single place higher. Escape cancels.
  await move("one", ["ArrowDown", "ArrowUp", "ArrowUp"]);
  await waitOrder("list", ["one", "tall", "two", "three", "four"]);
  await move("one", ["ArrowDown", "ArrowDown"], "Escape");
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(await order("list"), [
    "one",
    "tall",
    "two",
    "three",
    "four",
  ]);
  await page
    .getByRole("button", { name: /Page 3/ })
    .first()
    .click();
  await page.locator('[data-block-id="s-one"]').waitFor();
  await move("s-one", ["ArrowDown", "ArrowDown"]);
  await waitOrder("small", ["s-two", "s-three", "s-one", "s-four"]);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: tall and short blocks step one block per key press, up and down, to both ends; Escape cancels",
  );
} finally {
  await browser.close();
  await sql`delete from issues where id=${id}`;
  await sql`delete from users where id=${userId}`;
  await sql.end();
}
