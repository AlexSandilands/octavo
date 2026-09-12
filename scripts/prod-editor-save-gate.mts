// Run after npm run build, with a local DATABASE_URL and AUTH_SECRET:
// node --env-file=.env --import tsx scripts/prod-editor-save-gate.mts [port]
// Owns its server, cold-builds B with the A editor still open, cleans only its IDs.
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import postgres from "postgres";
import { emptyIssueContent, type IssueContent } from "../src/lib/blocks.ts";
import { gateServer } from "./editor-save-gate-server.mts";

assert(process.env.DATABASE_URL && process.env.AUTH_SECRET);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
  "local database only",
);
const server = gateServer(Number(process.argv[2] ?? 3295));
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const id = crypto.randomUUID();
const user = crypto.randomUUID();
const member = crypto.randomUUID();
const token = crypto.randomUUID();
const memberToken = crypto.randomUUID();
const expiredToken = crypto.randomUUID();
const imageId = crypto.randomUUID();
const logoId = crypto.randomUUID();
const name = `Save gate ${id.slice(0, 8)}`;
const endpoint = `${server.base}/api/admin/issues/${id}/save`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
context.setDefaultTimeout(10_000);
const page = await context.newPage();
const content = emptyIssueContent();
const ok = (message: string) => console.log(`ok — ${message}`);
const row = async () => {
  const [result] = await sql<
    {
      title: string;
      theme: string;
      logo_id: string | null;
      content: IssueContent;
      revision: number;
      status: string;
    }[]
  >`
    select title, theme, logo_id, content, revision, status from issues where id = ${id}`;
  assert(result);
  return result;
};
const waitRow = async (
  check: (r: Awaited<ReturnType<typeof row>>) => boolean,
) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check(await row())) return;
    await delay(100);
  }
  assert.fail("expected saved database state");
};
const saved = (p = page) => p.getByText("Saved", { exact: true }).waitFor();
const bodyTitle = (r: Awaited<ReturnType<typeof row>>) => {
  const block = r.content.pages[0]?.blocks[0];
  return block?.type === "heading" ? block.title : undefined;
};
const editContent = async (title: string, p = page) => {
  await p
    .getByRole("textbox", { name: "Cover title", exact: true })
    .fill(title);
};
const request = (
  data: unknown,
  headers: Record<string, string> = {},
  url = endpoint,
) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: server.base,
      Cookie: `authjs.session-token=${token}`,
      ...headers,
    },
    body: JSON.stringify(data),
  });
const rejects = async (
  data: unknown,
  status: number,
  headers?: Record<string, string>,
  url?: string,
) => {
  const before = await row();
  assert.equal((await request(data, headers, url)).status, status);
  assert.deepEqual(
    await row(),
    before,
    "rejected request cannot mutate the issue",
  );
};

try {
  await sql`insert into users (id, email, is_admin, subscribed) values
    (${user}, ${`${id}-admin@example.test`}, true, false),
    (${member}, ${`${id}-member@example.test`}, false, false)`;
  await sql`insert into sessions (session_token, user_id, expires) values
    (${token}, ${user}, now() + interval '1 hour'),
    (${memberToken}, ${member}, now() + interval '1 hour'),
    (${expiredToken}, ${user}, now() - interval '1 hour')`;
  const [created] = await sql<
    { number: number }[]
  >`insert into issues (id, number, title, content)
    values (${id}, (select coalesce(max(number), 0) + 1 from issues), ${name}, ${sql.json(content)}) returning number`;
  assert(created);
  await sql`insert into images (id, key, width, height) values (${imageId}, ${`i245/${id}.webp`}, 1, 1)`;
  await sql`insert into logos (id, name, image_id) values (${logoId}, ${name}, ${imageId})`;
  await server.start();
  const meta = { kind: "meta", meta: { title: "rejected" } };
  await rejects(meta, 403, { Cookie: "" });
  await rejects(meta, 403, { Cookie: `authjs.session-token=${memberToken}` });
  await rejects(meta, 403, { Cookie: `authjs.session-token=${expiredToken}` });
  await rejects(meta, 403, { Origin: "https://other.example" });
  await rejects(meta, 403, { Origin: "null" });
  await rejects(meta, 403, { Origin: "" });
  await rejects(meta, 415, { "Content-Type": "text/plain" });
  for (const invalid of [
    { kind: "nope" },
    { kind: "meta", meta: { title: "x".repeat(201) } },
    { kind: "meta", meta: { theme: "unknown" } },
    { kind: "meta", meta: { logoId: "bad-id" } },
    { kind: "meta", meta: { status: "published" } },
    { kind: "content", content, baseRevision: -1 },
    { kind: "content", content, baseRevision: 0.5 },
    { kind: "content", content: { pages: "bad" }, baseRevision: 0 },
  ])
    await rejects(invalid, 400);
  await rejects(meta, 400, {}, endpoint.replace(id, "bad-id"));
  await rejects(
    { kind: "content", content, baseRevision: 0 },
    404,
    {},
    endpoint.replace(id, crypto.randomUUID()),
  );
  await rejects(
    { kind: "meta", meta: { title: "x".repeat(1024 * 1024) } },
    413,
  );
  const malformed = await fetch(endpoint, {
    method: "POST",
    headers: {
      Origin: server.base,
      Cookie: `authjs.session-token=${token}`,
      "Content-Type": "application/json",
    },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await fetch(endpoint)).status, 405);
  // No Content-Length: enforce the cap on actual streamed bytes too.
  const oversized = await fetch(endpoint, {
    method: "POST",
    headers: {
      Origin: server.base,
      Cookie: `authjs.session-token=${token}`,
      "Content-Type": "application/json",
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024 + 1));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  assert.equal(oversized.status, 413);
  ok("admin, origin, JSON, payload limits and save validation fail closed");

  const normalized = structuredClone(content);
  normalized.pages[0]!.cover = false;
  const first = await request({
    kind: "content",
    content: normalized,
    baseRevision: 0,
  });
  assert.deepEqual(await first.json(), { ok: true, revision: 1 });
  assert.equal((await row()).content.pages[0]!.cover, true);
  await rejects({ kind: "content", content, baseRevision: 0 }, 409);
  assert.equal(
    (await request({ kind: "meta", meta: { logoId, theme: "modern" } })).status,
    200,
  );
  assert.equal(
    (await request({ kind: "meta", meta: { title: name } })).status,
    200,
  );
  assert.equal((await row()).logo_id, logoId, "omitted logo preserved");
  assert.equal(
    (await request({ kind: "meta", meta: { logoId: null, theme: "classic" } }))
      .status,
    200,
  );
  assert.equal((await row()).logo_id, null);
  assert.equal(
    (await row()).revision,
    1,
    "metadata does not change content revision",
  );
  ok(
    "cover normalization, revision conflicts and optional/null metadata semantics retained",
  );

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: server.base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  // Visit the list first to exercise Next's existing client navigation cache.
  await page.goto(`${server.base}/admin`);
  await page.locator(`a[href="/admin/issues/${id}/edit"]`).first().click();
  await page.getByPlaceholder("Untitled issue").waitFor();
  await editContent("Saved in build A");
  await waitRow((r) => bodyTitle(r) === "Saved in build A");
  await saved();
  const documentMarker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    Object.assign(window, { editorSaveGateMarker: marker });
    return marker;
  });
  const saves: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url() === endpoint) {
      assert.equal(req.headers()["next-action"], undefined);
      saves.push(req.postDataJSON().kind as string);
    }
  });
  console.log("Rebuilding while the build-A editor remains open…");
  await server.rebuild();
  await editContent("Saved from A into B");
  await page
    .getByPlaceholder("Untitled issue")
    .fill(`${name} after deployment`);
  await waitRow(
    (r) =>
      bodyTitle(r) === "Saved from A into B" &&
      r.title.endsWith("after deployment"),
  );
  await saved();
  assert.equal(
    await page.evaluate(() => Reflect.get(window, "editorSaveGateMarker")),
    documentMarker,
  );
  assert(saves.includes("content") && saves.includes("meta"));
  ok(
    "build-A editor saves content and metadata into build B without reloading or action IDs",
  );

  await page.route(endpoint, (route) => route.abort("internetdisconnected"));
  await editContent("Recovered after network failure");
  await page.getByText("Couldn’t save", { exact: true }).waitFor();
  assert.notEqual(bodyTitle(await row()), "Recovered after network failure");
  assert.equal(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
    true,
  );
  await page.unroute(endpoint);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await waitRow((r) => bodyTitle(r) === "Recovered after network failure");
  await saved();
  ok(
    "transport failure keeps edits, warns before leaving and retries successfully",
  );

  for (const response of [
    { status: 403, contentType: "application/json", body: '{"ok":false}' },
    { status: 500, contentType: "text/html", body: "upstream failure" },
    { status: 200, contentType: "application/json", body: '{"ok":true}' },
  ]) {
    await page.route(endpoint, (route) => route.fulfill(response));
    await editContent(`Recover ${response.status}`);
    await page.getByText("Couldn’t save", { exact: true }).waitFor();
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await waitRow((r) => bodyTitle(r) === `Recover ${response.status}`);
    await saved();
  }
  ok("auth, server and malformed-success responses never display Saved");

  await editContent("Flushed before Preview");
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(`**/admin/issues/${id}/preview`);
  await waitRow((r) => bodyTitle(r) === "Flushed before Preview");
  await popup.close();
  // Preview flushes immediately; let the pre-existing debounce finish too
  // before the second editor takes its revision snapshot.
  await delay(1200);
  await saved();
  ok("Preview flushes the newest edit through the stable endpoint");

  // A real second editor wins. The stale editor must stay blocked after 409.
  const other = await context.newPage();
  await other.goto(`${server.base}/admin/issues/${id}/edit`);
  await editContent("Other editor wins", other);
  await waitRow((r) => bodyTitle(r) === "Other editor wins");
  await saved(other);
  await editContent("Stale editor must not win");
  await page.getByText("Changed somewhere else", { exact: true }).waitFor();
  const conflictRevision = (await row()).revision;
  await editContent("Still must not win");
  await delay(1000);
  assert.equal((await row()).revision, conflictRevision);
  assert.equal(bodyTitle(await row()), "Other editor wins");
  await other.close();
  ok("two real editors retain conflict protection and stop stale writes");

  // Fresh build-B page: verify a title change is visible when returning to list.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`${server.base}/admin`);
  await page.locator(`a[href="/admin/issues/${id}/edit"]`).first().click();
  await page.getByPlaceholder("Untitled issue").fill(`${name} final`);
  await waitRow((r) => r.title === `${name} final`);
  await saved();
  await page.getByRole("link", { name: "Back to issues", exact: true }).click();
  await page.waitForURL("**/admin");
  await page.getByText(`${name} final`, { exact: true }).first().waitFor();
  ok("returning to the issue list shows the saved metadata");

  await page.locator(`a[href="/admin/issues/${id}/edit"]`).first().click();
  await editContent("Flushed before Publish");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const modal = page.getByRole("dialog");
  const email = modal.getByRole("checkbox");
  if (await email.isChecked()) await email.uncheck();
  assert.equal(
    await email.isChecked(),
    false,
    "never email members from the gate",
  );
  await modal.getByRole("button", { name: "Publish", exact: true }).click();
  await waitRow(
    (r) =>
      r.status === "published" && bodyTitle(r) === "Flushed before Publish",
  );
  await modal.getByRole("button", { name: "Done", exact: true }).click();
  ok("Publish flushes current content before publishing without email");

  // Existing mandatory production gate for admin mutations/list revalidation.
  const refresh = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "node_modules/tsx/dist/cli.mjs",
      "--tsconfig",
      "scripts/tsconfig.json",
      "scripts/prod-action-refresh-gate.mts",
      server.base,
    ],
    {
      env: server.runtime,
      stdio: "inherit",
    },
  );
  const [code] = await once(refresh, "exit");
  assert.equal(code, 0, "existing production action-refresh gate");
  ok("all editor save deployment checks passed");
} finally {
  await browser.close();
  await server.stop();
  await sql`delete from issues where id = ${id}`;
  await sql`delete from logos where id = ${logoId}`;
  await sql`delete from images where id = ${imageId}`;
  await sql`delete from users where id in (${user}, ${member})`;
  await sql.end();
}
