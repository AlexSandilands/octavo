// Dev-only: verifies the admin gate (issue #4) headless against a running dev
// server. Covers page redirects, the upload route, and — critically — DIRECT
// server-action invocation: it captures the real createIssueAction request an
// admin's browser sends, then replays that exact request signed out and as a
// non-admin member, asserting no DB write happens either way.
// Run: npx tsx scripts/dev-admin-gate.mts <base-url> <dev-log-path>
//
// SAFETY: it writes to the shared dev database, and owns every row it touches.
// It creates its own two members — one admin, one plain, tagged
// `admin-gate-<uuid>` under example.test — rather than assuming fixture
// accounts exist, and it tracks the issues it makes by id: the editor URL names
// the one the UI click created, an id-set diff around each replay names the
// one the replay created. The finally deletes exactly those, then the members
// with their sessions and verification tokens, and asserts the rows it did not
// create are still there. Nothing is ever found by title, status or address
// pattern — the dev database holds the owner's own "Untitled draft", which the
// pattern delete this replaced would have destroyed. A failed run cleans up the
// same way a passing one does, so this is safe against a shared dev database.
import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-admin-gate.mts <base-url> <dev-log>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// Everything this run creates, by id, so the finally removes exactly that.
const made = { users: [] as string[], issues: [] as string[] };
// Tagged so a row stranded by a killed run is recognisable at a glance. The tag
// is only ever written, never matched on to decide what to delete.
const runTag = `admin-gate-${crypto.randomUUID()}`;
const fixtureEmails: string[] = [];

const idsOf = (rows: readonly { id: string }[]) =>
  new Set(rows.map((r) => r.id));
const issueIds = async () =>
  idsOf(await sql<{ id: string }[]>`select id from issues`);
const imageIds = async () =>
  idsOf(await sql<{ id: string }[]>`select id from images`);
const addedSince = (before: Set<string>, after: Set<string>) =>
  [...after].filter((id) => !before.has(id));

// Rows that were here before this run, counted at both ends. The check that
// would have caught the title-pattern delete this script used to finish with.
const foreignCounts = async () => ({
  issues: [...(await issueIds())].filter((id) => !made.issues.includes(id))
    .length,
  users: (await sql<{ id: string }[]>`select id from users`).filter(
    (r) => !made.users.includes(r.id),
  ).length,
});
const before = await foreignCounts();
console.log(
  `baseline (not ours): ${before.issues} issues, ${before.users} users`,
);

// Membership IS the users table (server/auth.ts sends a link only to an address
// that already has a row), so the fixtures go straight in. Unsubscribed: a
// publish blast from anyone else on this database must not pick them up.
const addMember = async (role: string, isAdmin: boolean) => {
  const id = crypto.randomUUID();
  const email = `${runTag}-${role}@example.test`;
  await sql`insert into users (id, email, is_admin, subscribed)
    values (${id}, ${email}, ${isAdmin}, false)`;
  made.users.push(id);
  fixtureEmails.push(email);
  return { id, email };
};

const browser = await chromium.launch();

// An arrow, not a declaration: only a closure created *after* the usage guard
// above sees `base`/`logPath` as the strings that guard proved them to be.
const signIn = async (email: string): Promise<BrowserContext> => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/signin`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  const log = await readFile(logPath, "utf8");
  const link = [...log.matchAll(/\[auth\] {3}(http\S+)/g)]
    .map((m) => m[1])
    .at(-1)!;
  await page.goto(link);
  await page.waitForLoadState();
  await page.close();
  return ctx;
};

let failed = false;
try {
  const memberUser = await addMember("member", false);
  const adminUser = await addMember("admin", true);
  console.log(`fixtures: ${adminUser.email}, ${memberUser.email}`);

  // ── Signed out ─────────────────────────────────────────────────────────────
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${base}/admin`);
  await anonPage.waitForURL("**/signin");
  ok(true, "signed out: /admin → /signin");
  // The 200-streamed body must not contain admin UI, only the redirect payload.
  const raw = await (await anon.request.get(`${base}/admin`)).text();
  ok(
    !raw.includes("Create new issue"),
    "signed out: /admin body carries no admin content",
  );
  await anonPage.goto(`${base}/admin/issues/whatever/edit`);
  await anonPage.waitForURL("**/signin");
  ok(true, "signed out: editor route → /signin");

  // Each denied upload is checked against the image ids read immediately
  // before it, so the window in which someone else's upload could muddy the
  // answer is one request wide.
  const imagesBeforeAnonUpload = await imageIds();
  const upload = await anon.request.post(`${base}/api/admin/images`, {
    multipart: {
      file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") },
    },
  });
  ok(
    upload.status() === 403,
    `signed out: upload returns 403 (got ${upload.status()})`,
  );
  ok(
    addedSince(imagesBeforeAnonUpload, await imageIds()).length === 0,
    "signed out: the denied upload stored nothing",
  );

  // ── Non-admin member ───────────────────────────────────────────────────────
  const member = await signIn(memberUser.email);
  const memberPage = await member.newPage();
  await memberPage.goto(`${base}/admin`);
  await memberPage.waitForURL((u) => u.pathname === "/");
  ok(true, "member: /admin → / (library)");
  const imagesBeforeMemberUpload = await imageIds();
  const memberUpload = await member.request.post(`${base}/api/admin/images`, {
    multipart: {
      file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") },
    },
  });
  ok(memberUpload.status() === 403, "member: upload returns 403");
  ok(
    addedSince(imagesBeforeMemberUpload, await imageIds()).length === 0,
    "member: the denied upload stored nothing",
  );

  // ── Admin: capture a REAL server-action request, then replay it elsewhere ──
  const admin = await signIn(adminUser.email);
  const adminPage = await admin.newPage();
  let captured: {
    url: string;
    headers: Record<string, string>;
    body: Buffer;
  } | null = null;
  // A server action invocation is either a hydrated fetch (next-action header)
  // or, pre-hydration, a plain form POST carrying $ACTION_ID_<id> in the body.
  // Both run the action server-side, so capture whichever POST /admin we get.
  adminPage.on("request", (req) => {
    if (req.method() !== "POST" || new URL(req.url()).pathname !== "/admin")
      return;
    void req.allHeaders().then((headers) => {
      captured ??= {
        url: req.url(),
        headers,
        body: req.postDataBuffer() ?? Buffer.alloc(0),
      };
    });
  });
  await adminPage.goto(`${base}/admin`);
  const beforeCreate = await issueIds();
  await adminPage.click(
    "form button[type=submit]:has-text('Create new issue')",
  );
  await adminPage.waitForURL("**/admin/issues/*/edit");
  // The editor URL names the row the click just made — the unambiguous handle
  // that means this gate never has to guess from a title.
  const createdId = /\/admin\/issues\/([^/]+)\/edit/.exec(adminPage.url())?.[1];
  ok(createdId, `the editor URL carries the new issue id (${adminPage.url()})`);
  made.issues.push(createdId!);
  ok(
    !beforeCreate.has(createdId!) && (await issueIds()).has(createdId!),
    "admin: create-issue action works (control)",
  );
  for (let i = 0; i < 20 && !captured; i++)
    await new Promise((r) => setTimeout(r, 250));
  ok(captured !== null, "captured the real server-action request");

  const replay = async (cookie: string | undefined) => {
    const { url, headers, body } = captured!;
    const h: Record<string, string> = {
      "content-type": headers["content-type"] ?? "",
    };
    if (headers["next-action"]) h["next-action"] = headers["next-action"];
    if (cookie) h.cookie = cookie;
    const res = await fetch(url, {
      method: "POST",
      headers: h,
      // `fetch` won't take a Node Buffer; the same bytes as a plain Uint8Array.
      body: new Uint8Array(body),
      redirect: "manual",
    });
    return res.status;
  };
  const cookieHeader = async (ctx: BrowserContext) =>
    (await ctx.cookies(base)).map((c) => `${c.name}=${c.value}`).join("; ");

  let ids = await issueIds();
  await replay(undefined);
  ok(
    addedSince(ids, await issueIds()).length === 0,
    "replayed action signed out: NO issue created",
  );
  ids = await issueIds();
  await replay(await cookieHeader(member));
  ok(
    addedSince(ids, await issueIds()).length === 0,
    "replayed action as member: NO issue created",
  );
  ids = await issueIds();
  await replay(await cookieHeader(admin));
  const replayed = addedSince(ids, await issueIds());
  // Exactly one, or this run cannot tell its own row from a concurrent
  // writer's — and a row it cannot attribute is one the finally must not take.
  ok(
    replayed.length === 1,
    "replayed action as admin: issue created (proves replay is valid)" +
      (replayed.length === 1 ? "" : ` — saw ${replayed.length} new issues`),
  );
  made.issues.push(replayed[0]!);

  // ── Shell identity + sign-out ──────────────────────────────────────────────
  await adminPage.goto(`${base}/admin`);
  ok(
    (await adminPage.textContent("aside"))?.includes(adminUser.email),
    "sidebar shows the signed-in admin identity",
  );
  const adminSessions = async () =>
    Number(
      (
        await sql`select count(*)::int as n from sessions
          where user_id = ${adminUser.id}`
      )[0]!.n,
    );
  const sessionsBefore = await adminSessions();
  await adminPage.click("aside button:has-text('Sign out')");
  await adminPage.waitForURL("**/signin**");
  ok(true, "sign out lands on /signin");
  ok(
    (await adminSessions()) === sessionsBefore - 1,
    "sign out deleted this device's session row",
  );
  await adminPage.goto(`${base}/admin`);
  await adminPage.waitForURL("**/signin");
  ok(true, "after sign-out: /admin → /signin again");
} catch (err) {
  failed = true;
  console.error(err instanceof Error ? err.message : err);
} finally {
  await browser.close();

  // Only what this run made, by id. Issues first, then the members: their
  // sessions cascade, but going explicitly leaves nothing to infer, and the
  // verification tokens are keyed by address with no foreign key to cascade
  // through at all.
  if (made.issues.length) {
    await sql`delete from issues where id in ${sql(made.issues)}`;
  }
  if (made.users.length) {
    await sql`delete from sessions where user_id in ${sql(made.users)}`;
    await sql`delete from verification_tokens
      where identifier in ${sql(fixtureEmails)}`;
    await sql`delete from users where id in ${sql(made.users)}`;
  }

  const after = await foreignCounts();
  if (after.issues !== before.issues || after.users !== before.users) {
    failed = true;
    console.error(
      `FAIL: rows this run did not create changed — ` +
        `${JSON.stringify(before)} → ${JSON.stringify(after)} ` +
        `(this run reaching too far, or another writer on the same database)`,
    );
  } else {
    console.log(
      `ok — every pre-existing row is untouched ` +
        `(${after.issues} issues, ${after.users} users)`,
    );
  }
  await sql.end();
}

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
