// Dev-only: the image dialogs check a file before sending it (#368), as the
// assistant's composer does (#343). A 13 MB file in each of the image block,
// the montage dialog, the logo dialog and the sponsor dialog shows the route's
// words, "Image is too large (max 12 MB).", and makes no request to
// POST /api/admin/images; a wrong type reads "Unsupported image type." (sponsor);
// a montage batch sends the good file and names the refused one.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-upload-limits-gate.mts <base-url> [shots-dir]
//
// SAFETY: it mints its own admin, session and draft, and deletes them, the
// draft's uploaded photo (row and object) and nothing else. The logo and
// sponsor dialogs are closed unsaved, so they write nothing.
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import sharp from "sharp";
import { CONTENT_VERSION } from "../src/lib/blocks";
import {
  IMAGE_TOO_LARGE,
  IMAGE_UNSUPPORTED,
} from "../src/lib/image-upload-limits";
import { deleteByPrefix } from "../src/lib/storage";

process.loadEnvFile?.(".env.local");
const [base, shots] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-upload-limits-gate.mts <url> [shots]");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `upload-limits-gate-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const draftId = crypto.randomUUID();
const imageBlock = crypto.randomUUID();
const montageBlock = crypto.randomUUID();
const content = {
  version: CONTENT_VERSION,
  pages: [
    { id: crypto.randomUUID(), cover: true, blocks: [] },
    {
      id: crypto.randomUUID(),
      blocks: [
        { id: imageBlock, type: "image", caption: "", align: "full" },
        { id: montageBlock, type: "montage", items: [], caption: "" },
      ],
    },
  ],
};

const huge = (name: string) => ({
  name,
  mimeType: name.endsWith(".png") ? "image/png" : "image/jpeg",
  buffer: Buffer.alloc(13 * 1024 * 1024, 1),
});

/** Every upload request the page makes, by the size of its body. */
function watchUploads(page: Page) {
  const sizes: number[] = [];
  void page.route("**/api/admin/images", (route) => {
    sizes.push(route.request().postDataBuffer()?.length ?? 0);
    return route.continue();
  });
  return sizes;
}

/** The words appear within `within` (the open dialog, else the page). */
const shown = (page: Page, words: string, within = "body") =>
  page
    .locator(within)
    .getByText(words)
    .first()
    .waitFor({ timeout: 5_000 })
    .then(
      () => true,
      () => false,
    );

async function editorChecks(page: Page, sizes: number[]) {
  await page.goto(`${base}/admin/issues/${draftId}/edit`);
  await page.click('button[aria-label="Page 2"]');

  heading("the image block");
  await page.click(`[data-block-id="${imageBlock}"]`);
  await page.waitForSelector(
    '[data-block-bar] button:has-text("Upload image")',
  );
  await page.setInputFiles(
    '[data-block-bar] input[type="file"]',
    huge("harbour.jpg"),
  );
  ok(await shown(page, IMAGE_TOO_LARGE), "a 13 MB photo: the route's words");
  ok(sizes.length === 0, "and no request was made");
  ok(
    await page.isEnabled('[data-block-bar] button:has-text("Upload image")'),
    "the button is ready for another file",
  );

  heading("the montage dialog");
  await page.click(`[data-block-id="${montageBlock}"]`);
  await page.click('button:text-is("Add images")');
  await page.waitForSelector("[role=dialog]");
  const picker = '[role=dialog] input[type="file"]';
  await page.setInputFiles(picker, huge("regatta.jpg"));
  ok(
    await shown(page, IMAGE_TOO_LARGE, "[role=dialog]"),
    "a 13 MB photo: the route's words",
  );
  ok(sizes.length === 0, "and no request was made");
  const small = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "#3a7" },
  })
    .png()
    .toBuffer();
  await page.setInputFiles(picker, [
    { name: "green.png", mimeType: "image/png", buffer: small },
    huge("regatta.jpg"),
  ]);
  await page.waitForSelector("[role=dialog] :text('Images (1)')", {
    timeout: 30_000,
  });
  ok(
    await shown(page, `regatta.jpg: ${IMAGE_TOO_LARGE}`, "[role=dialog]"),
    "a batch names the refused file",
  );
  ok(
    sizes.length === 1 && sizes[0]! < 1024 * 1024,
    `only the good file was sent (${sizes.length} request)`,
  );
  await page.click('[role=dialog] button:has-text("Done")');
  await page.waitForSelector("[role=dialog]", { state: "detached" });
}

async function adminDialog(
  page: Page,
  sizes: number[],
  path: string,
  opener: RegExp,
) {
  const before = sizes.length;
  await page.goto(`${base}${path}`);
  // A press before the page hydrates opens nothing: press until it opens.
  for (let i = 0; !(await page.isVisible("[role=dialog]")); i++) {
    if (i === 20) throw new Error(`FAIL: ${opener} never opened its dialog`);
    await page.getByRole("button", { name: opener }).first().click();
    await page.waitForTimeout(500);
  }
  await page.setInputFiles(
    '[role=dialog] input[type="file"]',
    huge("mark.png"),
  );
  ok(
    await shown(page, IMAGE_TOO_LARGE, "[role=dialog]"),
    "a 13 MB mark: the route's words",
  );
  ok(sizes.length === before, "and no request was made");
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  await sql`insert into issues (id, title, theme, status, content) values
    (${draftId}, ${tag}, 'classic', 'draft', ${sql.json(content as never)})`;
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
  const page = await ctx.newPage();
  const sizes = watchUploads(page);
  await editorChecks(page, sizes);

  heading("the logo dialog");
  await adminDialog(page, sizes, "/admin/magazine", /^Add logo$/);
  if (shots) {
    await mkdir(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/logo-dialog-too-large.png` });
  }

  heading("the sponsor dialog");
  await adminDialog(
    page,
    sizes,
    "/admin/sponsors",
    // The empty list's button says "Add your first sponsor".
    /^Add (your first )?sponsor$/,
  );
  const before = sizes.length;
  await page.setInputFiles('[role=dialog] input[type="file"]', {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a picture"),
  });
  ok(
    await shown(page, IMAGE_UNSUPPORTED, "[role=dialog]"),
    "a text file: the route's words",
  );
  ok(sizes.length === before, "and no request was made");
  if (shots)
    await page.screenshot({ path: `${shots}/sponsor-dialog-unsupported.png` });

  console.log("\nupload limits gate: all checks passed");
} finally {
  await browser.close();
  await sql`delete from images where issue_id = ${draftId}`;
  await deleteByPrefix(`issues/${draftId}/`);
  await sql`delete from issues where id = ${draftId}`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
