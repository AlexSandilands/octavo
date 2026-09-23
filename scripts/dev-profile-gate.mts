// Dev-only: the member profile page (issue #300) end to end against a running
// server — posting names, the avatar route, both email toggles, the admin's
// posting-names dialog, the /preferences redirect and a keyboard-only pass.
//
// It mints its own check-300 members and sessions, one per scenario so the
// per-member rate limits never collide, and removes every row and uploaded
// object in the finally. `settings.comments_enabled` is expected on; the
// switched-off check flips it off and back to what it found.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-profile-gate.mts <base-url> [out-dir]
import { mkdir, rm, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import postgres from "postgres";
import sharp from "sharp";
import { chromium, type Browser, type Page } from "playwright";
import { membersGate } from "./profile-gate-admin.mts";
import { avatarsGate, uploader } from "./profile-gate-avatars.mts";
import type { Member, ProfileKit } from "./profile-gate-kit.mts";

process.loadEnvFile?.(".env.local");
register("./fixtures/discussion/session-hooks.mjs", import.meta.url);
const { actAs } = await import("./fixtures/discussion/session-stub.mts");
const names = await import("../src/server/member-names.ts");
const thread = await import("../src/server/comments.ts");
const profileActions = await import("../src/app/profile/actions.ts");
const { emptyIssueContent } = await import("../src/lib/blocks.ts");

const base = process.argv[2];
if (!base) throw new Error("usage: dev-profile-gate.mts <base-url> [out-dir]");
const out = path.resolve(process.argv[3] ?? ".data/profile-review");
await mkdir(out, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok — ${msg}`);
  else {
    failures++;
    console.log(`  FAIL — ${msg}`);
  }
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = crypto.randomUUID().slice(0, 8);
const made: Member[] = [];
let issueId: string | null = null;

async function member(
  label: string,
  opts: { admin?: boolean; name?: string | null } = {},
): Promise<Member> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const email = `check-300-${tag}-${label}@example.invalid`;
  await sql`insert into users (id, email, name, is_admin, email_verified)
            values (${id}, ${email}, ${opts.name ?? null}, ${opts.admin ?? false}, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${id}, now() + interval '1 day')`;
  const m = { id, email, token, isAdmin: opts.admin ?? false };
  made.push(m);
  return m;
}

async function nameRow(userId: string, name: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into member_names (id, user_id, name, name_key)
    values (${crypto.randomUUID()}, ${userId}, ${name}, ${name.toLowerCase()})
    returning id`;
  return row!.id;
}

const as = (m: Member | null) =>
  actAs(
    m ? { id: m.id, email: m.email, isAdmin: m.isAdmin, name: null } : null,
  );

async function open(browser: Browser, m: Member, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([
    { name: "authjs.session-token", value: m.token, url: base! },
  ]);
  const page = await ctx.newPage();
  await page.goto(`${base}/profile`);
  await page.waitForSelector("h1:has-text('Your profile')");
  return page;
}

const liveRegion = "section[aria-labelledby=names-heading] [role=status]";
async function heard(page: Page, text: string) {
  try {
    await page.waitForFunction(
      ([sel, want]) =>
        document.querySelector(sel!)?.textContent?.includes(want!) ?? false,
      [liveRegion, text],
      { timeout: 10_000 },
    );
    return true;
  } catch {
    return false;
  }
}

async function addName(page: Page, value: string) {
  await page.fill("#add-name", value);
  await page.click("button:has-text('Add name')");
}

async function namesOf(userId: string) {
  return sql<
    { id: string; name: string; retired: boolean; avatar: string | null }[]
  >`select id, name, retired_at is not null as retired,
           avatar_image_id as avatar
    from member_names where user_id = ${userId} order by created_at, id`;
}

const smallJpeg = await sharp({
  create: { width: 400, height: 300, channels: 3, background: "#3a6" },
})
  .jpeg()
  .toBuffer();
const upload = uploader(base);

const [settingsBefore] = await sql<{ on: boolean | null }[]>`
  select comments_enabled as on from settings where id = 1`;
if (!settingsBefore?.on) {
  throw new Error("comments_enabled must be on for this gate (the baseline).");
}

const browser = await chromium.launch();
const kit: ProfileKit = {
  browser,
  base,
  sql,
  out,
  ok,
  heading,
  member,
  nameRow,
  as,
  upload,
  smallJpeg,
  open: (m, width) => open(browser, m, width),
  heard,
};
try {
  // ── Redirects and entry points ────────────────────────────────────────────
  heading("entry");
  const redirect = await fetch(`${base}/preferences`, { redirect: "manual" });
  ok(
    redirect.status === 308 &&
      new URL(redirect.headers.get("location")!, base).pathname === "/profile",
    `/preferences answers 308 → /profile (got ${redirect.status} ${redirect.headers.get("location")})`,
  );
  const signedOut = await fetch(`${base}/profile`, { redirect: "manual" });
  ok(
    signedOut.status === 307 &&
      signedOut.headers.get("location")?.includes("/signin?next=%2Fprofile"),
    `signed out, /profile goes to /signin carrying ?next (got ${signedOut.status})`,
  );

  const a = await member("names", { name: "Margaret Cole" });
  const other = await member("other");
  await nameRow(other.id, "Shared Name");

  let page = await open(browser, a);
  ok(
    (await page.inputValue("#add-name")) === "Margaret Cole",
    "with no names, the field is prefilled with users.name",
  );
  await page.goto(`${base}/`);
  const avatarLink = page.locator('a[aria-label="Your profile"]');
  ok(
    (await avatarLink.getAttribute("href")) === "/profile",
    "the header avatar links to /profile, named “Your profile”",
  );
  const box = await avatarLink.boundingBox();
  ok(
    box && box.width >= 44 && box.height >= 44,
    `the header avatar is a 44px target (${box?.width}×${box?.height})`,
  );
  ok(
    (await page
      .locator('footer a:has-text("Email preferences")')
      .getAttribute("href")) === "/profile#email",
    "the footer's Email preferences link points at /profile#email",
  );

  // ── Names ─────────────────────────────────────────────────────────────────
  heading("names — add, refusals, shared, the fifth");
  page = await open(browser, a);
  await page.click("button:has-text('Add name')");
  ok(await heard(page, "Added “Margaret Cole”."), "the suggestion is added");
  await addName(page, "  margaret   COLE ");
  await page.waitForSelector("#add-name-error");
  ok(
    (await page.textContent("#add-name-error")) ===
      "You already have this name.",
    "the same name in another case/spacing is refused",
  );
  for (const [value, want, what] of [
    ["Agent 007", "no numbers or symbols", "a digit"],
    ["Admin", "That name is reserved", "a reserved word"],
    ["Shithead", "can't be used", "a profanity"],
  ] as const) {
    await addName(page, value);
    const text = (await page.textContent("#add-name-error")) ?? "";
    ok(text.includes(want), `${what} is refused: “${text}”`);
  }
  await addName(page, "Shared Name");
  ok(
    await heard(page, "Another member also uses this name."),
    "a name another account uses is saved and the note announced",
  );
  ok(
    await page.isVisible("li:has-text('Shared Name') >> text=add an initial"),
    "the shared-name note shows beside that name",
  );
  for (const value of ["Peggy Cole", "M. Cole"]) {
    await addName(page, value);
    await heard(page, `Added “${value}”.`);
  }
  await addName(page, "Meg Cole");
  ok(await heard(page, "Added “Meg Cole”."), "a fifth name is added");
  await page.waitForSelector("text=the most one account can hold");
  ok(await page.isDisabled("#add-name"), "the add field closes at five names");
  as(a);
  const sixth = await names.addName({ name: "Maggie Cole" });
  ok(
    !sixth.ok && sixth.reason.includes("up to 5"),
    `a sixth name is refused by the server too (“${sixth.ok ? "" : sixth.reason}”)`,
  );
  const aNames = await namesOf(a.id);
  ok(aNames.length === 5, `five names stored (${aNames.length})`);

  heading("names — rename, remove, retire, the last one");
  const r = await member("rename", { name: "Robin Hart" });
  const [keep, used, spare] = [
    await nameRow(r.id, "Robin Hart"),
    await nameRow(r.id, "Robin H"),
    await nameRow(r.id, "Spare Name"),
  ];
  issueId = crypto.randomUUID();
  await sql`insert into issues (id, title, theme, status, content, number, published_at)
            values (${issueId}, ${`check-300 ${tag}`}, 'classic', 'published',
                    ${sql.json(emptyIssueContent())},
                    (select coalesce(max(number), 0) + 7000 from issues), now())`;
  as(r);
  const posted = await thread.createComment({
    issueId,
    body: "check-300 comment",
    nameId: used,
  });
  ok(posted.ok, "a comment is posted under “Robin H” (in process)");
  page = await open(browser, r);
  await page.click('button[aria-label="Rename Robin H"]');
  await page.fill(`#rename-${used}`, "Robin Hartley");
  await page.keyboard.press("Enter");
  ok(
    await heard(page, "Renamed to “Robin Hartley”."),
    "rename saves and is announced",
  );
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  ok(
    focused === "Rename Robin Hartley",
    `focus returns to Rename (${focused})`,
  );
  const listed = await thread.listComments(issueId, {
    id: r.id,
    isAdmin: false,
  });
  const shown = JSON.stringify(listed);
  ok(
    shown.includes("Robin Hartley") && !shown.includes('"Robin H"'),
    "listComments shows the renamed name on the old comment",
  );

  await page.click('button[aria-label="Remove Spare Name"]');
  await page.waitForSelector("[role=dialog]");
  ok(
    (await page.textContent("[role=dialog]"))!.includes("goes completely"),
    "Remove on an unused name says it goes completely",
  );
  await page.click("[role=dialog] button:has-text('Remove name')");
  ok(await heard(page, "Removed “Spare Name”."), "the unused name is removed");
  ok(
    !(await namesOf(r.id)).some((n) => n.id === spare),
    "the unused name's row is deleted",
  );
  await page.click('button[aria-label="Remove Robin Hartley"]');
  await page.waitForSelector("[role=dialog]");
  ok(
    (await page.textContent("[role=dialog]"))!.includes(
      "Your past comments keep this name; you won’t be able to post as it.",
    ),
    "Remove on a used name says it is retired",
  );
  await page.click("[role=dialog] button:has-text('Remove name')");
  ok(
    await heard(page, "Your past comments keep this name"),
    "the used name is retired",
  );
  ok(
    (await namesOf(r.id)).find((n) => n.id === used)?.retired === true,
    "the used name's row is retired, not deleted",
  );
  ok(
    JSON.stringify(
      await thread.listComments(issueId, { id: r.id, isAdmin: false }),
    ).includes("Robin Hartley"),
    "the retired name is still on its comment",
  );
  const lastRemove = page.locator('button[aria-label="Remove Robin Hart"]');
  ok(
    (await lastRemove.getAttribute("aria-disabled")) === "true",
    "the last name's Remove is unavailable",
  );
  ok(
    await page.isVisible("text=your only name can’t be removed"),
    "and the page says why",
  );
  const lastTry = await names.removeName(keep);
  ok(!lastTry.ok, "the server refuses to remove the last name too");

  // ── Badge ─────────────────────────────────────────────────────────────────
  heading("admin badge");
  ok(
    (await page.locator("text=Show admin badge").count()) === 0,
    "a member sees no badge checkbox",
  );
  const refusedBadge = await profileActions.setBadgeAction(keep, true);
  ok(
    !refusedBadge.ok && refusedBadge.reason === "Only admins can show a badge.",
    "a non-admin's badge write is refused",
  );
  const adm = await member("admin", { admin: true });
  const admName = await nameRow(adm.id, "Chair Person");
  page = await open(browser, adm);
  const badge = page.getByRole("checkbox", {
    name: "Show admin badge on Chair Person",
  });
  ok(await badge.isVisible(), "an admin sees the badge checkbox per name");
  await badge.focus();
  await page.keyboard.press("Space");
  ok(
    await heard(page, "now show an Admin badge"),
    "ticking it saves and announces",
  );
  const [badged] =
    await sql`select badge from member_names where id = ${admName}`;
  ok(badged?.badge === true, "the badge is stored");
  await page.screenshot({ path: `${out}/profile-admin.png`, fullPage: true });
  await writeFile(
    `${out}/profile-admin.aria.txt`,
    await page.locator("main").ariaSnapshot(),
  );

  // ── Avatars ───────────────────────────────────────────────────────────────
  const { p, pName } = await avatarsGate(kit, admName);

  // ── Email ─────────────────────────────────────────────────────────────────
  heading("email");
  const [defaults] = await sql`
    select count(*)::int as n from users
    where reply_emails and email not like 'check-300-%'`;
  console.log(
    `  (members outside this run with reply emails on: ${defaults?.n})`,
  );
  const e = await member("email");
  page = await open(browser, e);
  const issues = page.locator("form[aria-labelledby=email-issues] button");
  const replies = page.locator("form[aria-labelledby=email-replies] button");
  ok(
    (await replies.textContent()) === "Turn these emails on",
    "reply emails start off",
  );
  await issues.click();
  await page.waitForSelector(
    "form[aria-labelledby=email-issues] >> text=Turn these emails on",
  );
  await replies.click();
  await page.waitForSelector(
    "form[aria-labelledby=email-replies] >> text=Turn these emails off",
  );
  const [prefs] =
    await sql`select subscribed, reply_emails from users where id = ${e.id}`;
  ok(
    prefs?.subscribed === false && prefs?.reply_emails === true,
    "both toggles write their own flag",
  );

  heading("switched off");
  await sql`update settings set comments_enabled = false where id = 1`;
  try {
    page = await open(browser, a);
    ok(
      (await page.locator("#names-heading").count()) === 0 &&
        (await page.locator("#email-replies").count()) === 0 &&
        (await page.locator("#email-issues").count()) === 1,
      "Names and the reply toggle are hidden; the issue toggle stays",
    );
    const offUpload = await upload(p, pName, smallJpeg);
    ok(offUpload.status === 403, "the upload route refuses while off");
  } finally {
    await sql`update settings set comments_enabled = ${settingsBefore.on} where id = 1`;
  }

  // ── Keyboard-only walkthrough ─────────────────────────────────────────────
  heading("keyboard");
  page = await open(browser, r);
  // Forward through the page until focus leaves <main> (Next's dev overlay
  // and the document follow it). A field is measured by its decorated box.
  const stops: { name: string; height: number }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.closest("main")) return null;
      const target = el.closest(".boxed-field") ?? el;
      const name =
        el.getAttribute("aria-label") ??
        (el.id
          ? document.querySelector(`label[for="${el.id}"]`)?.textContent
          : null) ??
        el.textContent?.trim() ??
        "";
      return {
        name: `${el.tagName.toLowerCase()}[${name.slice(0, 32)}]`,
        height: Math.round(target.getBoundingClientRect().height),
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  console.log(
    `  tab order: ${stops.map((s) => `${s.name} ${s.height}px`).join(" → ")}`,
  );
  const small = stops.filter((s) => s.height < 44);
  ok(
    stops.length >= 7 && small.length === 0,
    `every stop is reachable and at least 44px (${small.map((s) => s.name).join(", ") || "all"})`,
  );
  await writeFile(
    `${out}/profile-member.aria.txt`,
    await page.locator("main").ariaSnapshot(),
  );
  await page.screenshot({ path: `${out}/profile-member.png`, fullPage: true });

  // ── Admin members list and dialog ─────────────────────────────────────────
  await membersGate(kit);
} finally {
  await browser.close();
  actAs(null);
  const ids = made.map((m) => m.id);
  if (issueId) await sql`delete from issues where id = ${issueId}`;
  const avatars = await sql<{ id: string; key: string }[]>`
    select i.id, i.key from member_names n join images i on i.id = n.avatar_image_id
    where n.user_id = any(${ids})`;
  if (ids.length) {
    await sql`delete from sessions where user_id = any(${ids})`;
    await sql`delete from users where id = any(${ids})`;
  }
  for (const { id, key } of avatars) {
    await sql`delete from images where id = ${id}`;
    await rm(path.join(".data", "uploads", key), { force: true });
  }
  const [after] = await sql<{ on: boolean | null }[]>`
    select comments_enabled as on from settings where id = 1`;
  console.log(
    `\nscratch rows removed; comments_enabled ${after?.on} (found ${settingsBefore.on})`,
  );
  await sql.end();
}
console.log(failures === 0 ? "\nPASS — profile gate" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
