// Dev-only: verifies the logo library (issue #92) end-to-end against a running
// dev server — upload a mark at /admin/logos, list it, rename it, delete it, and
// confirm the stored file still has real transparency after the sharp → WebP →
// storage pipeline (the whole point of a logo mark). Also checks that a
// non-admin is refused.
//
// The test image defaults to a generated transparent PNG so the check is
// self-contained; pass a path to use a real club mark instead.
//
// Run: npx tsx scripts/dev-logos-gate.mts <base-url> <dev-log> <admin-email> [png]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath, adminEmail, pngArg] = process.argv.slice(2);
if (!base || !logPath || !adminEmail) {
  throw new Error(
    "usage: dev-logos-gate.mts <base-url> <dev-log> <admin-email> [png]",
  );
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// A transparent mark to upload: a solid ring on a fully transparent field, so
// the file genuinely carries both opaque and see-through pixels.
async function generateMark(): Promise<string> {
  const dest = path.join(process.cwd(), ".data", "tmp", "logo-gate-mark.png");
  await mkdir(path.dirname(dest), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
    <circle cx="160" cy="160" r="120" fill="none" stroke="#1d4d3e" stroke-width="40"/>
  </svg>`;
  await writeFile(dest, await sharp(Buffer.from(svg)).png().toBuffer());
  return dest;
}

const markPath = pngArg ?? (await generateMark());
const markBytes = await readFile(markPath);
const sourceMeta = await sharp(markBytes).metadata();
const sourceStats = await sharp(markBytes).stats();
ok(
  sourceMeta.hasAlpha && !sourceStats.isOpaque,
  `test mark ${path.basename(markPath)} (${sourceMeta.width}×${sourceMeta.height}) is transparent to begin with`,
);

const browser = await chromium.launch();

// Wait for a magic link newer than `after` for this email (the dev transport
// logs "[auth] magic link for <email>:\n[auth]   <url>").
async function magicLink(email: string, after: number) {
  const re = new RegExp(
    `\\[auth\\] magic link for ${email.replace(/[.@+]/g, "\\$&")}:\\n\\[auth\\] {3}(http\\S+)`,
    "g",
  );
  for (let i = 0; i < 40; i++) {
    const links = [...(await readFile(logPath!, "utf8")).matchAll(re)];
    if (links.length > after) return links.at(-1)![1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no new magic link for ${email}`);
}

const seen = new Map<string, number>();
async function signIn(email: string): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/signin`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  const before = seen.get(email) ?? 0;
  seen.set(email, before + 1);
  await page.goto(await magicLink(email, before));
  await page.waitForLoadState();
  await page.close();
  return ctx;
}

const admin = await signIn(adminEmail);
const page: Page = await admin.newPage();

// ── 1. Upload a logo through the admin UI ────────────────────────────────────
// Clear anything a previous interrupted run left behind, so the selectors below
// (and the exact-name lookups) can't match a stale row.
await sql`delete from logos where name like 'Gate Fern%'`;
await page.goto(`${base}/admin/logos`);
await page.waitForSelector("h1:has-text('Logos')");
const empty = await page
  .locator("button:has-text('Add your first logo')")
  .count();
await page.click(
  empty > 0
    ? "button:has-text('Add your first logo')"
    : "button:has-text('Add logo')",
);
await page.fill("#logo-name", "Gate Fern");
await page.setInputFiles("input[type=file]", markPath);
await page.waitForSelector("button:has-text('Replace image')"); // upload landed
await page.click("button:has-text('Save logo')");
await page.waitForSelector("text=Gate Fern");
ok(true, "uploaded a logo named 'Gate Fern' via the admin UI");

const [row] = await sql`
  select l.id, l.name, i.key from logos l
  join images i on i.id = l.image_id where l.name = 'Gate Fern'`;
ok(row?.key, "logo persisted with an images row");
const logoId = row!.id as string;

// ── 2. The stored file is still transparent ──────────────────────────────────
// Fetch what storage actually serves (not the buffer we uploaded) and inspect
// it: an alpha channel that is present *and* carries non-opaque pixels.
const stored = await page.request.get(`${base}/api/images/${row!.key}`);
ok(stored.ok(), `stored mark is served from ${row!.key}`);
const bytes = Buffer.from(await stored.body());
const meta = await sharp(bytes).metadata();
const stats = await sharp(bytes).stats();
ok(meta.format === "webp", "stored mark went through the pipeline (WebP)");
ok(meta.hasAlpha && meta.channels === 4, "stored mark has an alpha channel");
ok(stats.isOpaque === false, "stored mark has genuinely non-opaque pixels");
const alpha = stats.channels[3]!;
ok(
  alpha.min === 0 && alpha.max === 255,
  `alpha spans fully transparent to fully opaque (min ${alpha.min}, max ${alpha.max})`,
);

// ── 3. Rename ────────────────────────────────────────────────────────────────
await page.click("button[aria-label='Rename Gate Fern']");
await page.fill("#logo-name", "Gate Fern Renamed");
await page.click("button:has-text('Save name')");
await page.waitForSelector("text=Gate Fern Renamed");
const [renamed] = await sql`select name from logos where id = ${logoId}`;
ok(renamed!.name === "Gate Fern Renamed", "renaming persists");

// ── 4. Non-admin is refused ──────────────────────────────────────────────────
const memberEmail = process.env.LOGO_GATE_MEMBER_EMAIL ?? "member@example.com";
const [memberRow] = await sql`
  select count(*)::int n from users where email = ${memberEmail} and is_admin = false`;
if (memberRow!.n > 0) {
  const member = await signIn(memberEmail);
  const memberPage = await member.newPage();
  // requireAdminOrRedirect() sends a signed-in non-admin to the library. The
  // redirect resolves through the client router, so wait for the URL rather
  // than the load event (which fires first) — same as dev-admin-gate.mts.
  await memberPage.goto(`${base}/admin/logos`);
  await memberPage.waitForURL((u) => u.pathname === "/");
  ok(true, `non-admin ${memberEmail}: /admin/logos → / (library)`);
  // The redirect streams a 200, so also assert the body carries no logo UI.
  const body = await (await member.request.get(`${base}/admin/logos`)).text();
  ok(
    !body.includes("Add logo") && !body.includes("Add your first logo"),
    "non-admin: /admin/logos body carries no logo-library content",
  );
  // And the mutation itself is gated, not just the page.
  const memberUpload = await member.request.post(`${base}/api/admin/images`, {
    multipart: {
      file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") },
    },
  });
  ok(
    memberUpload.status() === 403,
    `non-admin: the upload route the dialog uses returns 403 (got ${memberUpload.status()})`,
  );
  await member.close();
} else {
  console.log(`skip — no non-admin user ${memberEmail} to test the gate with`);
}

// ── 5. Delete ────────────────────────────────────────────────────────────────
await page.goto(`${base}/admin/logos`);
await page.click("button[aria-label='Delete Gate Fern Renamed']");
await page.click("button:has-text('Delete logo')"); // confirm dialog
await page.waitForSelector("button[aria-label='Delete Gate Fern Renamed']", {
  state: "detached",
});
const [gone] =
  await sql`select count(*)::int n from logos where id = ${logoId}`;
ok(gone!.n === 0, "logo deleted from the library");

await browser.close();
await sql.end();
console.log("\nall checks passed");
