// Production-build gate: the nonce-based CSP (src/proxy.ts) must not block any
// script. A hard load of each page, and client transitions between pages, must
// log no CSP violation, fail no request with a CSP error, and serve no
// <script>/<link rel=preload as=script|modulepreload> tag without the nonce.
// Next 16.3.1–16.3.4 emitted a loading/error-boundary chunk with no nonce, so
// one chunk (next/link) was blocked on every page with a loading.tsx (#319).
//
// Run against a production server (dummy env as in the other prod-* gates):
//   rm -rf .next && npm run build
//   R2_ACCOUNT_ID=dummy R2_ACCESS_KEY_ID=dummy R2_SECRET_ACCESS_KEY=dummy \
//   R2_BUCKET=dummy R2_PUBLIC_URL=http://localhost:19999 EMAIL_API_KEY=x \
//   EMAIL_FROM=x@example.invalid npx next start -p 3319
//   npx tsx --tsconfig scripts/tsconfig.json scripts/prod-csp-gate.mts http://localhost:3319
// It mints a scratch admin session, a published issue and a draft, and removes them.
import postgres from "postgres";
import { chromium, type Browser } from "playwright";
import { randomUUID } from "node:crypto";
import { emptyIssueContent } from "../src/lib/blocks.ts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: prod-csp-gate.mts <base-url>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const stamp = randomUUID().slice(0, 8);
const userId = `csp-gate-${stamp}`;
const token = `csp-gate-tok-${stamp}`;
const publishedId = randomUUID();
const draftId = randomUUID();
const number = 900000 + Math.floor(Math.random() * 90000);

type Win = {
  __spa?: number;
  next: { router: { push(href: string): void } };
};

// zod probes `Function("")` in a try/catch and falls back when the CSP (no
// 'unsafe-eval') refuses it, so an "eval" violation is expected and harmless.
const EVAL_PROBE = /unsafe-eval|evaluate a string/i;

const problems: string[] = [];
const flag = (where: string, what: string) => {
  problems.push(`${where}: ${what}`);
  console.log(`  FAIL ${what}`);
};

/** Tags the browser would run or preload that carry no nonce. */
function nonceLessTags(html: string): string[] {
  return [...html.matchAll(/<(?:script|link)\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) =>
      tag.startsWith("<script")
        ? !/\snonce=/.test(tag)
        : /rel="(?:preload|modulepreload)"/.test(tag) &&
          /as="script"|rel="modulepreload"/.test(tag) &&
          !/\snonce=/.test(tag),
    );
}

async function visit(
  browser: Browser,
  start: string,
  signedIn: boolean,
  next?: { via: "click"; href: string } | { via: "push"; href: string },
) {
  const label = next ? `${start} -> ${next.href}` : start;
  console.log(`\n${label}`);
  const ctx = await browser.newContext();
  if (signedIn)
    await ctx.addCookies([
      {
        name: "authjs.session-token",
        value: token,
        url: base!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (EVAL_PROBE.test(m.text())) return;
    if (/Content Security Policy/.test(m.text()))
      flag(
        label,
        m
          .text()
          .replace(/'nonce-[^']+'/, "'nonce-…'")
          .slice(0, 200),
      );
  });
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText.toLowerCase().includes("csp"))
      flag(label, `request blocked by CSP: ${r.url()}`);
  });
  await page.addInitScript(() =>
    window.addEventListener(
      "securitypolicyviolation",
      (e) =>
        e.blockedURI !== "eval" &&
        console.error(
          `Content Security Policy event: ${e.blockedURI} (${e.violatedDirective}) at ${e.sourceFile}:${e.lineNumber} ${e.sample}`,
        ),
      true,
    ),
  );
  // The served HTML, fetched with the same session, audited for the nonce.
  const html = await (await ctx.request.get(base + start)).text();
  if (!/\snonce="[^"]+"/.test(html))
    flag(label, "served HTML carries no nonce");
  for (const tag of nonceLessTags(html))
    flag(label, `no nonce: ${tag.slice(0, 140)}`);

  await page.goto(base + start, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (next) {
    await page.evaluate(() => ((window as unknown as Win).__spa = 1));
    if (next.via === "click") await page.click(`a[href="${next.href}"]`);
    else
      await page.evaluate(
        (h) => (window as unknown as Win).next.router.push(h),
        next.href,
      );
    await page
      .waitForURL(`**${next.href}`, { timeout: 8000 })
      .catch(() => flag(label, "the transition never landed"));
    await page.waitForTimeout(1500);
    if (!(await page.evaluate(() => (window as unknown as Win).__spa === 1)))
      flag(label, "fell back to a full page load");
  }
  await ctx.close();
}

await sql`insert into users (id, email, is_admin, subscribed, email_verified)
          values (${userId}, ${`${userId}@example.invalid`}, true, false, now())`;
await sql`insert into sessions (session_token, user_id, expires)
          values (${token}, ${userId}, now() + interval '1 day')`;
await sql`insert into issues (id, title, content)
          values (${draftId}, ${`CSP gate draft ${stamp}`}, ${sql.json(emptyIssueContent())})`;
await sql`insert into issues (id, title, status, number, published_at, content)
          values (${publishedId}, ${`CSP gate issue ${stamp}`}, 'published', ${number},
                  now(), ${sql.json(emptyIssueContent())})`;

const browser = await chromium.launch();
try {
  const pages: [string, boolean][] = [
    ["/signin", false],
    ["/", true],
    ["/admin", true],
    ["/admin/members", true],
    ["/admin/sponsors", true],
    ["/admin/help", true],
    ["/admin/magazine", true],
    ["/admin/reports", true],
    [`/read/${number}`, true],
    [`/admin/issues/${draftId}/edit`, true],
  ];
  for (const [path, signedIn] of pages) await visit(browser, path, signedIn);
  console.log("\n── client transitions ──");
  for (const [from, to] of [
    ["/admin", "/admin/members"],
    ["/admin", "/admin/sponsors"],
    ["/admin/reports", "/admin/help"],
    ["/admin/members", "/admin/magazine"],
  ] as const)
    await visit(browser, from, true, { via: "click", href: to });
  await visit(browser, "/admin", true, {
    via: "push",
    href: `/admin/issues/${draftId}/edit`,
  });
  await visit(browser, "/", true, { via: "push", href: "/archive" });
} finally {
  await browser.close();
  await sql`delete from issues where id in (${draftId}, ${publishedId})`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}

if (problems.length) {
  console.log(`\n${problems.length} CSP problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(
  "\nok — no CSP violations and no nonce-less scripts on any page or transition",
);
