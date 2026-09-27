// Dev-only: photos attached in the assistant's chat (#343), with the fake provider:
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3343 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-assistant-attach-gate.mts http://localhost:3343
// Two photos attached by the keyboard through Attach photos and one pasted,
// each an `images` row for the issue made by the upload route; thumbnails with
// text alternatives and remove buttons the keyboard reaches; the request
// carries the ids and no image bytes; a scripted insert_blocks places one and
// the run's line names the other two as unplaced; one Undo takes the placement
// back. A wrong type and a file too large are refused in the browser in the
// route's words, and the route refuses a 13 MB body by its length; a paste
// carrying text is text; seven attached photos are each looked at without
// using a view, leaving the page views (#365); an eleventh photo is refused
// with a note, repeated names are numbered, and closing the panel keeps the tray. (Its own gate rather than
// more of dev-assistant-tools-gate.mts, which is at the 500-line limit.)
//
// SAFETY: shared dev database. It mints its own admin, session and draft; the
// finally deletes those, the photos uploaded to the draft (rows and objects)
// and the ai_usage its runs left.
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import sharp from "sharp";
import { AI_PROJECTION_PART } from "../src/lib/ai-chat-contract";
import { deleteByPrefix } from "../src/lib/storage";
import {
  content,
  watchChat,
  photoId,
  until,
  type Doc,
} from "./fixtures/assistant/tools-gate-kit.mts";

process.loadEnvFile?.(".env.local");
const [base] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-assistant-attach-gate.mts <url>");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `assistant-attach-gate-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const draftId = crypto.randomUUID();

const BUTTON = 'nav[aria-label="Editor panels"] button[aria-label="Assistant"]';
const INPUT = "#assistant-input";
const ATTACH = 'button[aria-label="Attach photos"]';
const THUMB = "[data-attachment]";
const PICKER = "input[data-attach-input]";
const LOG = '[role="log"]';
const RUN = "[data-assistant-run]";

const png = (r: number, g: number, b: number) =>
  sharp({
    create: { width: 480, height: 320, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
const file = (name: string, mimeType: string, buffer: Buffer) => ({
  name,
  mimeType,
  buffer,
});

const saved = async (): Promise<Doc> =>
  (
    await sql<
      { content: Doc }[]
    >`select content from issues where id = ${draftId}`
  )[0]!.content;
const placed = (doc: Doc) =>
  doc.pages.flatMap((p) => p.blocks).map((b) => b.imageId as string);
const focused = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
const settled = (page: Page, n: number) =>
  page.waitForFunction(
    ([sel, count]) => {
      const all = [...document.querySelectorAll(sel as string)];
      return (
        all.length === count &&
        all.every((el) => el.getAttribute("data-attachment") !== "uploading")
      );
    },
    [THUMB, n] as const,
    { timeout: 30_000 },
  );
const attachedIds = (page: Page) =>
  page.$$eval(THUMB, (els) =>
    els.map((el) => el.getAttribute("data-attachment")!),
  );
async function paste(page: Page, name: string, bytes: Buffer) {
  await page.focus(INPUT);
  await page.evaluate(
    ([n, b64]) => {
      const bin = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bin], n!, { type: "image/png" }));
      document
        .querySelector("#assistant-input")!
        .dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
        );
    },
    [name, bytes.toString("base64")] as const,
  );
}
async function attachByKeyboard(page: Page, files: object[]) {
  await page.focus(INPUT);
  await page.keyboard.press("Tab");
  ok((await focused(page)) === "Attach photos", "Tab from the box: Attach");
  // Enter on Attach clicks the file input, as a person's would. The files then
  // go to the input directly: headless Chromium doesn't reliably raise its
  // chooser for a scripted press, which is the harness, not the product.
  await page.$eval(PICKER, (el) => {
    el.addEventListener("click", () => el.setAttribute("data-picked", ""), {
      once: true,
    });
  });
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${PICKER}[data-picked]`, { state: "attached" });
  await page.$eval(PICKER, (el) => el.removeAttribute("data-picked"));
  await page.setInputFiles(PICKER, files as never);
}
/** Opens the panel and waits out its slide: a key pressed mid-slide opens no
 *  file chooser (Folio's finding, as the panel gate waits since #349). */
async function openPanel(page: Page) {
  await page.click(BUTTON);
  await page.waitForSelector(INPUT);
  await page.waitForFunction(() => {
    const el = document.querySelector("aside#editor-side-panel");
    return (
      el &&
      !el.hasAttribute("aria-hidden") &&
      el.getAnimations({ subtree: true }).length === 0
    );
  });
}

async function checks(page: Page) {
  const chat = watchChat(page);
  const bodies: string[] = [];
  let uploaded = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/admin/ai/chat")) bodies.push(req.postData()!);
    if (req.url().endsWith("/api/admin/images")) uploaded++;
  });
  await page.goto(`${base}/admin/issues/${draftId}/edit`);
  await page.click('button[aria-label="Page 2"]');
  await openPanel(page);

  heading("the first-use note says where photos go");
  ok(
    (await page.textContent(LOG))?.includes(
      "the assistant’s provider sees them",
    ),
    "the intro says attached photos are sent to the provider",
  );

  heading("attach two by the button, one by paste");
  const [red, green, blue, grey] = await Promise.all([
    png(200, 40, 40),
    png(40, 160, 60),
    png(40, 60, 200),
    png(120, 120, 120),
  ]);
  await attachByKeyboard(page, [
    file("harbour.png", "image/png", red),
    file("regatta.png", "image/png", green),
  ]);
  await settled(page, 2);
  await paste(page, "committee.png", blue);
  await settled(page, 3);
  const ids = await attachedIds(page);
  const rows = await sql<{ id: string }[]>`
    select id from images where issue_id = ${draftId} and id in ${sql(ids)}`;
  ok(rows.length === 3, "each is an images row for the issue");
  const alts = await page.$$eval(`${THUMB} img`, (els) =>
    els.map((el) => el.getAttribute("alt")),
  );
  ok(
    alts.join("|") === "harbour.png|regatta.png|committee.png",
    `every thumbnail has a text alternative (${alts.join(", ")})`,
  );
  ok(
    (await page.textContent("[data-attachment-status]"))?.includes(
      "3 photos attached",
    ),
    "the tray says 3 photos attached",
  );

  heading("remove by keyboard");
  await paste(page, "spare.png", grey);
  await settled(page, 4);
  await page.focus(INPUT);
  await page.keyboard.press("Shift+Tab");
  ok((await focused(page)) === "Remove spare.png", "Shift+Tab: its remove");
  await page.keyboard.press("Enter");
  await settled(page, 3);
  ok(
    (await focused(page)) === "Remove committee.png",
    "removed; the focus moves to the thumbnail before it",
  );

  heading("send: ids, not bytes; one placed, two reported");
  const script = JSON.stringify([
    {
      toolName: "insert_blocks",
      input: {
        after: { page: 2 },
        blocks: [{ kind: "image", imageId: ids[0], alt: "A red harbour." }],
      },
    },
  ]);
  const from = bodies.length;
  await page.fill(INPUT, `Lay these out [fake:tools]${script}`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 60_000 },
  );
  ok(
    chat.asked[0]?.endsWith(`Attached 3 photos: ${ids.join(", ")}`),
    "the message carries the three ids",
  );
  const asked = JSON.parse(bodies[from]!) as {
    messages: { role: string; parts: { type: string }[] }[];
  };
  ok(
    asked.messages
      .at(-1)!
      .parts.map((p) => p.type)
      .join() === `${AI_PROJECTION_PART},text,text` &&
      bodies.slice(from).every((b) => !/data:image|;base64,/.test(b)),
    "as [projection, words, ids]: no image bytes in any of the run's requests",
  );
  ok(
    (await page.textContent(LOG))?.includes("Step 1: insert_blocks."),
    "(the server runs the fake provider)",
  );
  ok((await page.$$(THUMB)).length === 0, "the tray emptied");
  const bubble = await page.textContent(`${LOG} .self-end`);
  ok(
    bubble?.includes("3 photos attached") && !bubble.includes(ids[1]!),
    "the author's bubble counts them, without ids",
  );
  await until("autosave of the placement", async () =>
    placed(await saved()).includes(ids[0]!),
  );
  const line = (await page.textContent(RUN))?.trim() ?? "";
  ok(
    line.includes("Changed 1 block on page 2") &&
      line.includes("2 attached photos weren’t placed"),
    `the run's line names the two unplaced (${line})`,
  );
  await page.click(`${RUN} button:text-is("Undo")`);
  await until(
    "autosave of the Undo",
    async () => !placed(await saved()).includes(ids[0]!),
  );
  ok(true, "one Undo took the placement back");

  heading("a refused file: the route's words, never sent, nothing sent");
  const sent = bodies.length;
  const uploads = () => uploaded;
  const before = uploads();
  await attachByKeyboard(page, [
    file("notes.png", "text/plain", Buffer.from("not a picture")),
    file("huge.jpg", "image/jpeg", Buffer.alloc(13 * 1024 * 1024, 1)),
  ]);
  await settled(page, 2);
  const alert = await page.textContent("[data-attachment-alert]");
  ok(
    alert?.includes("notes.png: Unsupported image type.") &&
      alert.includes("huge.jpg: Image is too large (max 12 MB)."),
    "a wrong type and one too large: the route's words",
  );
  ok(uploads() === before, "checked in the browser: neither was uploaded");
  await page.fill(INPUT, "Place these");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_000);
  ok(
    bodies.length === sent && (await page.inputValue(INPUT)) === "Place these",
    "Enter sent nothing; the words stay",
  );
  for (const name of ["notes.png", "huge.jpg"])
    await page.click(`button[aria-label="Remove ${name}"]`);
  await page.fill(INPUT, "");
  // The route itself, outside the proxy: too big is refused on its length.
  const direct = await page.evaluate(async (issueId) => {
    const body = new FormData();
    body.append("file", new File([new Uint8Array(13 * 1024 * 1024)], "x.jpg"));
    body.append("issueId", issueId);
    const res = await fetch("/api/admin/images", { method: "POST", body });
    return { status: res.status, error: (await res.json()).error as string };
  }, draftId);
  ok(
    direct.status === 413 && direct.error === "Image is too large (max 12 MB).",
    `the route refuses a 13 MB body by its length (${direct.status})`,
  );

  heading("a paste with text is text");
  await page.focus(INPUT);
  await page.evaluate((b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.setData("text/plain", "An article pasted from Word.");
    data.items.add(new File([bin], "image.png", { type: "image/png" }));
    document
      .querySelector("#assistant-input")!
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
      );
  }, red.toString("base64"));
  await page.waitForTimeout(500);
  ok(
    (await page.$$(THUMB)).length === 0,
    "Office's picture beside the text isn't attached",
  );

  heading("seven attached: every look is free, the page views are left");
  const seven = await Promise.all(
    Array.from({ length: 7 }, (_, i) => png(i * 30, 60, 120)),
  );
  await attachByKeyboard(
    page,
    seven.map((b, i) => file(`s${i}.png`, "image/png", b)),
  );
  await settled(page, 7);
  const sevenIds = await attachedIds(page);
  const looks = await chat.runScript([
    ...sevenIds.map((imageId) => ({
      toolName: "view_photo",
      input: { imageId },
    })),
    { toolName: "view_photo", input: { imageId: sevenIds[0]! } },
    { toolName: "view_page", input: { page: 2 } },
  ]);
  ok(
    looks.outputs
      .slice(0, 7)
      .every((o) =>
        o.includes("attached to this message: this look used no view"),
      ),
    "each attached photo's first look used no view",
  );
  ok(
    looks.outputs[7]?.includes("5 views left") &&
      looks.outputs[8]?.startsWith("Page 2") &&
      looks.outputs[8].includes("4 views left"),
    `a second look and a page view come from the six (${looks.outputs[8]?.slice(0, 60)})`,
  );

  heading("ten a message, numbered names, kept when the panel closes");
  const eleven = await Promise.all(
    Array.from({ length: 11 }, (_, i) => png(i * 20, 90, 90)),
  );
  await attachByKeyboard(
    page,
    eleven.map((b) => file("image.png", "image/png", b)),
  );
  await settled(page, 10);
  ok(
    (await page.textContent("[data-attachment-alert]"))?.includes(
      "Up to 10 photos a message. One wasn't attached.",
    ),
    "the eleventh is left out, with a note",
  );
  ok(await page.$eval(ATTACH, (el) => el.hasAttribute("disabled")), "full");
  const names = await page.$$eval(`${THUMB} img`, (els) =>
    els.map((el) => el.getAttribute("alt")),
  );
  ok(
    names[0] === "image.png" && names[1] === "image.png (2)",
    `repeated names are numbered (${names.slice(0, 3).join(", ")}…)`,
  );
  await page.click(
    'nav[aria-label="Editor panels"] button[aria-label="Close panel"]',
  );
  await openPanel(page);
  ok((await page.$$(THUMB)).length === 10, "closing the panel kept the tray");

  console.log("\nassistant attach gate: all checks passed");
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  await sql`insert into issues (id, title, theme, status, content) values
    (${draftId}, ${tag}, 'classic', 'draft', ${sql.json({ version: 10, ...content } as never)})`;
  await sql`insert into images (id, key, width, height, issue_id)
    values (${photoId}, ${`${tag}/photo.webp`}, 1600, 1067, ${draftId})`;
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await checks(await ctx.newPage());
} finally {
  await browser.close();
  await sql`delete from ai_usage where user_id = ${adminId} or issue_id = ${draftId}`;
  await sql`delete from images where issue_id = ${draftId}`;
  await deleteByPrefix(`issues/${draftId}/`);
  await sql`delete from issues where id = ${draftId}`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
