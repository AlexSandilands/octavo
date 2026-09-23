// What the halves of dev-discussion-gate.mts share (issue #301): scratch rows
// written straight to the database — every one carries the check-301 prefix
// and is removed by id — plus the browser helpers the sections lean on.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Browser, BrowserContext, Page } from "playwright";
import type postgres from "postgres";

// Storage imports "server-only", which resolves only under scripts/tsconfig.json.
const storage = () => import("../src/lib/storage.ts");

export type Sql = postgres.Sql;
export type Member = { id: string; email: string; token: string };
export type Issue = { id: string; number: number | null };

export type Kit = ReturnType<typeof discussionKit>;

export function discussionKit(opts: {
  sql: Sql;
  base: string;
  browser: Browser;
  out: string;
}) {
  const { sql, base, browser, out } = opts;
  const stamp = `check-301-${randomUUID().slice(0, 8)}`;
  const made = { users: [] as string[], issues: [] as string[] };
  const objects: string[] = [];
  let failures = 0;

  const ok = (cond: unknown, msg: string) => {
    if (cond) console.log(`  ok — ${msg}`);
    else {
      failures++;
      console.log(`  FAIL — ${msg}`);
    }
  };
  const heading = (name: string) =>
    console.log(`\n── ${name} `.padEnd(74, "─"));

  async function member(
    label: string,
    o: { admin?: boolean; name?: string | null } = {},
  ): Promise<Member> {
    const id = randomUUID();
    const token = `${stamp}-${label}-session`;
    const email = `${stamp}-${label}@example.invalid`;
    await sql`insert into users (id, email, name, is_admin, subscribed, email_verified)
      values (${id}, ${email}, ${o.name ?? null}, ${o.admin ?? false}, false, now())`;
    await sql`insert into sessions (session_token, user_id, expires)
      values (${token}, ${id}, now() + interval '1 day')`;
    made.users.push(id);
    return { id, email, token };
  }

  async function name(
    userId: string,
    text: string,
    o: { badge?: boolean; avatar?: boolean } = {},
  ) {
    const id = randomUUID();
    let imageId: string | null = null;
    if (o.avatar) {
      imageId = randomUUID();
      const key = `check-301/${stamp}/${imageId}.webp`;
      const bytes = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#b0413e" },
      })
        .webp()
        .toBuffer();
      await (await storage()).putObject(key, bytes, "image/webp");
      objects.push(key);
      await sql`insert into images (id, key, width, height)
        values (${imageId}, ${key}, 64, 64)`;
    }
    await sql`insert into member_names (id, user_id, name, name_key, badge, avatar_image_id)
      values (${id}, ${userId}, ${text}, ${text.toLowerCase()}, ${o.badge ?? false}, ${imageId})`;
    return id;
  }

  // A published copy of a real issue's content (so the flipbook has pages to
  // lay out), numbered far above the real ones; or a numberless draft.
  async function issue(published = true, offset = 0): Promise<Issue> {
    const id = randomUUID();
    const [source] = await sql<{ content: unknown }[]>`
      select content from issues where status = 'published'
      order by number limit 1`;
    const [max] = await sql<{ n: number }[]>`
      select coalesce(max(number), 0)::int as n from issues where title not like 'check-301-%'`;
    const number = published ? max!.n + 7000 + offset : null;
    await sql`insert into issues (id, number, title, content, status, published_at)
      values (${id}, ${number}, ${`${stamp} issue ${made.issues.length}`},
        ${sql.json(source!.content as never)},
        ${published ? "published" : "draft"}, ${published ? new Date() : null})`;
    made.issues.push(id);
    return { id, number };
  }

  async function comment(
    issueId: string,
    author: Member,
    nameId: string,
    body: string,
    o: { parentId?: string; ago?: string } = {},
  ) {
    const id = randomUUID();
    await sql`insert into comments (id, issue_id, author_id, author_name_id, parent_id, body, created_at)
      values (${id}, ${issueId}, ${author.id}, ${nameId}, ${o.parentId ?? null}, ${body},
        now() - ${o.ago ?? "1 hour"}::interval)`;
    return id;
  }

  async function context(
    who: Member | null,
    viewport = { width: 1280, height: 860 },
  ): Promise<BrowserContext> {
    const ctx = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 768,
    });
    if (who) {
      await ctx.addCookies([
        { name: "authjs.session-token", value: who.token, url: base },
      ]);
    }
    return ctx;
  }

  /** The reader for an issue, as `who`, at a viewport; waits for its chrome. */
  async function reader(
    who: Member | null,
    number: number,
    o: { width?: number; height?: number; query?: string } = {},
  ): Promise<{ page: Page; ctx: BrowserContext; listCalls: () => number }> {
    const width = o.width ?? 1280;
    const ctx = await context(who, { width, height: o.height ?? 860 });
    const page = await ctx.newPage();
    let calls = 0;
    page.on("request", (r) => {
      if (/\/api\/issues\/\d+\/comments/.test(r.url())) calls++;
    });
    await page.goto(`${base}/read/${number}${o.query ?? ""}`);
    await page.waitForSelector(
      width >= 768
        ? '[aria-label="Zoom page"]'
        : 'button[aria-label="Contents"]',
      { timeout: 60_000 },
    );
    return { page, ctx, listCalls: () => calls };
  }

  /** The open dialog's panel (the first, i.e. the shell, unless stacked). */
  const shell = (page: Page) => page.locator("[role=dialog]").first();

  async function waitThread(page: Page) {
    await page.waitForSelector(
      "[role=dialog] form textarea#discussion-composer, [role=dialog] :text('Discussion is for members.')",
      {
        timeout: 30_000,
      },
    );
  }

  const activeLabel = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "<body>";
      return (el.getAttribute("aria-label") || el.id || el.textContent || "")
        .trim()
        .slice(0, 60);
    });

  async function shot(page: Page, file: string) {
    await page.screenshot({ path: `${out}/${file}.png` });
  }

  async function cleanup() {
    if (made.issues.length) {
      await sql`delete from issues where id = any(${made.issues})`;
    }
    if (made.users.length) {
      await sql`delete from users where id = any(${made.users})`;
    }
    if (objects.length) {
      await sql`delete from images where key = any(${objects})`;
      const s = await storage();
      for (const key of objects) await s.deleteObject(key);
    }
    const [left] = await sql<{ n: number }[]>`
      select (select count(*) from users where email like 'check-301-%')
           + (select count(*) from issues where title like 'check-301-%')
           + (select count(*) from images where key like 'check-301/%') as n`;
    return Number(left?.n ?? 0);
  }

  return {
    sql,
    base,
    browser,
    out,
    stamp,
    ok,
    heading,
    failures: () => failures,
    member,
    name,
    issue,
    comment,
    context,
    reader,
    shell,
    waitThread,
    activeLabel,
    shot,
    cleanup,
  };
}
