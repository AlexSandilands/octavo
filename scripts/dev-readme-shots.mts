// Dev-only: capture the README screenshots (issue #52) against a running dev
// server. Signs in as a member (magic link from the dev log) for the library +
// reader shots, and as the admin for the editor shot. Writes PNGs to
// docs/assets/. Not part of the app.
// Run: npx tsx scripts/dev-readme-shots.mts <base-url> <dev-log-path>
import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-readme-shots.mts <base-url> <dev-log>");

const OUT = "docs/assets";
const MEMBER = "member@example.com";
const ADMIN = "profile.alex@proton.me";
const EDITOR_ISSUE = "2bfa1ada-bc3c-47c3-bb3f-1192edfcaefa"; // Drainage & Other Dramas

const browser = await chromium.launch();

async function magicLink(email: string, after: number) {
  const re = new RegExp(
    `\\[auth\\] magic link for ${email.replace(/[.@]/g, "\\$&")}:\\n\\[auth\\] {3}(http\\S+)`,
    "g",
  );
  for (let i = 0; i < 40; i++) {
    const links = [...(await readFile(logPath!, "utf8")).matchAll(re)];
    if (links.length > after) return links.at(-1)![1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no new magic link for ${email}`);
}

// Count this email's magic links already in the log, so after requesting a new
// one we wait for a link beyond that baseline (never a stale/consumed token —
// the log accumulates across runs).
async function linkBaseline(email: string) {
  const re = new RegExp(
    `\\[auth\\] magic link for ${email.replace(/[.@]/g, "\\$&")}:`,
    "g",
  );
  return [...(await readFile(logPath!, "utf8")).matchAll(re)].length;
}

async function signIn(ctx: BrowserContext, email: string) {
  const page = await ctx.newPage();
  await page.goto(`${base}/signin`);
  const baseline = await linkBaseline(email);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  await page.goto(await magicLink(email, baseline));
  await page.waitForLoadState("networkidle");
  await page.close();
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`ok — ${OUT}/${name}.png`);
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- member: library + readers -------------------------------------------
const member = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await signIn(member, MEMBER);

const lib = await member.newPage();
await lib.goto(`${base}/`, { waitUntil: "networkidle" });
await pause(600);
await shot(lib, "library");
await lib.close();

// Desktop flipbook — open to a two-page spread.
const desk = await member.newPage();
await desk.goto(`${base}/read/2`, { waitUntil: "networkidle" });
await pause(1500); // reader chunk + first paint
await desk.click('button[title="Next"]').catch(() => {});
await pause(1500); // let the page-turn settle
await desk.click('button[title="Next"]').catch(() => {});
await pause(1800);
await shot(desk, "reader-desktop");
await desk.close();
await member.close();

// Mobile scroll reader — phone viewport.
const phone = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await signIn(phone, MEMBER);
const mob = await phone.newPage();
await mob.goto(`${base}/read/2`, { waitUntil: "networkidle" });
await pause(1500);
await shot(mob, "reader-mobile");
await mob.close();
await phone.close();

// ---- admin: editor --------------------------------------------------------
const admin = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await signIn(admin, ADMIN);
const ed = await admin.newPage();
await ed.goto(`${base}/admin/issues/${EDITOR_ISSUE}/edit`, {
  waitUntil: "networkidle",
});
await pause(1800);
await shot(ed, "editor");
await ed.close();
await admin.close();

await browser.close();
console.log("\nall screenshots captured");
