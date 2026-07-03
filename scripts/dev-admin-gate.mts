// Dev-only: verifies the admin gate (issue #4) headless against a running dev
// server. Covers page redirects, the upload route, and — critically — DIRECT
// server-action invocation: it captures the real createIssueAction request an
// admin's browser sends, then replays that exact request signed out and as a
// non-admin member, asserting no DB write happens either way.
// Run: npx tsx scripts/dev-admin-gate.mts <base-url> <dev-log-path>
import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-admin-gate.mts <base-url> <dev-log>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const issueCount = async () =>
  Number((await sql`select count(*)::int as n from issues`)[0]!.n);

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const browser = await chromium.launch();

async function signIn(email: string): Promise<BrowserContext> {
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
}

// ── Signed out ───────────────────────────────────────────────────────────────
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

const upload = await anon.request.post(`${base}/api/admin/images`, {
  multipart: {
    file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") },
  },
});
ok(
  upload.status() === 403,
  `signed out: upload returns 403 (got ${upload.status()})`,
);
const uploadsBefore = Number(
  (await sql`select count(*)::int as n from images`)[0]!.n,
);

// ── Non-admin member ─────────────────────────────────────────────────────────
const member = await signIn("member@example.com");
const memberPage = await member.newPage();
await memberPage.goto(`${base}/admin`);
await memberPage.waitForURL((u) => u.pathname === "/");
ok(true, "member: /admin → / (library)");
const memberUpload = await member.request.post(`${base}/api/admin/images`, {
  multipart: {
    file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") },
  },
});
ok(memberUpload.status() === 403, "member: upload returns 403");

// ── Admin: capture a REAL server-action request, then replay it elsewhere ────
const admin = await signIn("admin@example.com");
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
const before = await issueCount();
await adminPage.click("form button[type=submit]:has-text('Create new issue')");
await adminPage.waitForURL("**/admin/issues/*/edit");
ok(
  (await issueCount()) === before + 1,
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
    body,
    redirect: "manual",
  });
  return res.status;
};
const cookieHeader = async (ctx: BrowserContext) =>
  (await ctx.cookies(base)).map((c) => `${c.name}=${c.value}`).join("; ");

let n = await issueCount();
await replay(undefined);
ok((await issueCount()) === n, "replayed action signed out: NO issue created");
await replay(await cookieHeader(member));
ok((await issueCount()) === n, "replayed action as member: NO issue created");
await replay(await cookieHeader(admin));
ok(
  (await issueCount()) === n + 1,
  "replayed action as admin: issue created (proves replay is valid)",
);
// Clean up the two issues this test created (both are Untitled drafts).
await sql`delete from issues where title = 'Untitled draft' and status = 'draft'`;

ok(
  uploadsBefore ===
    Number((await sql`select count(*)::int as n from images`)[0]!.n),
  "denied uploads stored nothing",
);

// ── Shell identity + sign-out ────────────────────────────────────────────────
await adminPage.goto(`${base}/admin`);
ok(
  (await adminPage.textContent("aside")).includes("admin@example.com"),
  "sidebar shows the signed-in admin identity",
);
const adminSessions = async () =>
  Number(
    (
      await sql`select count(*)::int as n from sessions s
        join users u on u.id = s.user_id where u.email = 'admin@example.com'`
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

await browser.close();
await sql.end();
console.log("\nall checks passed");
