// What the sections of dev-notifications-gate.mts share (issue #303): scratch
// rows written straight to the database — every one carries the check-303
// prefix and is removed by id — the dev-log harvest, and browser helpers.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext, Page } from "playwright";
import type postgres from "postgres";

export type Sql = postgres.Sql;
export type Member = { id: string; email: string; token: string };
export type Kit = ReturnType<typeof notificationsKit>;

/** The bell in the library header. */
export const BELL = 'header button[aria-haspopup="menu"]';
export const MENU = '[role=menu][aria-label="Notifications"]';

export function notificationsKit(opts: {
  sql: Sql;
  base: string;
  browser: Browser;
  out: string;
  log: string;
}) {
  const { sql, base, browser, out, log } = opts;
  const stamp = `check-303-${randomUUID().slice(0, 8)}`;
  const made = { users: [] as string[], issues: [] as string[] };
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
    o: { account?: string; replyEmails?: boolean; subscribed?: boolean } = {},
  ): Promise<Member> {
    const id = randomUUID();
    const token = `${stamp}-${label}-session`;
    const email = `${stamp}-${label}@example.invalid`;
    await sql`insert into users (id, email, name, subscribed, reply_emails, email_verified)
      values (${id}, ${email}, ${o.account ?? null}, ${o.subscribed ?? false},
        ${o.replyEmails ?? false}, now())`;
    await sql`insert into sessions (session_token, user_id, expires)
      values (${token}, ${id}, now() + interval '1 day')`;
    made.users.push(id);
    return { id, email, token };
  }

  async function name(userId: string, text: string) {
    const id = randomUUID();
    await sql`insert into member_names (id, user_id, name, name_key)
      values (${id}, ${userId}, ${text}, ${text.toLowerCase()})`;
    return id;
  }

  // A published copy of a real issue's content, numbered far above the rest.
  async function issue(offset = 0): Promise<{ id: string; number: number }> {
    const id = randomUUID();
    const [source] = await sql<{ content: unknown }[]>`
      select content from issues where status = 'published'
      order by number limit 1`;
    const [max] = await sql<{ n: number }[]>`
      select coalesce(max(number), 0)::int as n from issues
      where title not like 'check-%'`;
    const number = max!.n + 8000 + offset;
    await sql`insert into issues (id, number, title, content, status, published_at)
      values (${id}, ${number}, ${`${stamp} issue ${made.issues.length}`},
        ${sql.json(source!.content as never)}, 'published', now())`;
    made.issues.push(id);
    return { id, number };
  }

  // A comment straight into the table; with `notify`, the parent's author
  // gets the row createComment would have written.
  async function comment(
    issueId: string,
    author: Member,
    nameId: string,
    body: string,
    o: { parentId?: string; ago?: string; notify?: string } = {},
  ) {
    const id = randomUUID();
    await sql`insert into comments (id, issue_id, author_id, author_name_id, parent_id, body, created_at)
      values (${id}, ${issueId}, ${author.id}, ${nameId}, ${o.parentId ?? null},
        ${body}, now() - ${o.ago ?? "1 hour"}::interval)`;
    if (o.notify) {
      await sql`insert into notifications (id, user_id, comment_id, created_at)
        values (${randomUUID()}, ${o.notify}, ${id},
          now() - ${o.ago ?? "1 hour"}::interval)`;
    }
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

  /** The library as `who`, header rendered. */
  async function library(who: Member | null, width = 1280) {
    const ctx = await context(who, { width, height: 860 });
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    await page.waitForSelector("header nav", { timeout: 60_000 });
    return { ctx, page };
  }

  const bellLabel = async (page: Page) =>
    (await page.locator(BELL).count())
      ? page.locator(BELL).getAttribute("aria-label")
      : null;

  /** The open menu's item names, in order, as a screen reader hears them. */
  const menuTexts = (page: Page) =>
    page
      .locator(`${MENU} [role=menuitem]`)
      .evaluateAll((els) =>
        els.map((e) =>
          (e.getAttribute("aria-label") ?? e.textContent ?? "").trim(),
        ),
      );

  const activeLabel = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "<body>";
      return (el.getAttribute("aria-label") || el.textContent || el.id || "")
        .trim()
        .slice(0, 90);
    });

  // Every "[tag] <label> <email>:" entry in the dev log, oldest first — the
  // rest of its line, or the indented line under it.
  async function logged(tag: string, label: string, email: string) {
    const text = await readFile(log, "utf8");
    const re = new RegExp(
      `\\[${tag}\\] ${label} ${email.replace(/[.@]/g, "\\$&")}:(?: (.*)|\\n\\[${tag}\\] {3}(\\S+))`,
      "g",
    );
    return [...text.matchAll(re)].map((m) => (m[1] ?? m[2])!);
  }

  /** Waits for more than `after` entries and returns the newest. */
  async function nextLogged(
    tag: string,
    label: string,
    email: string,
    after: number,
  ): Promise<string | null> {
    for (let i = 0; i < 60; i++) {
      const found = await logged(tag, label, email);
      if (found.length > after) return found.at(-1)!;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  async function shot(page: Page, file: string) {
    await page.screenshot({ path: `${out}/${file}.png` });
  }

  async function cleanup() {
    if (made.users.length) {
      const emails = await sql<{ email: string }[]>`
        select email from users where id = any(${made.users})`;
      await sql`delete from verification_tokens
        where identifier = any(${emails.map((e) => e.email)})`;
    }
    if (made.issues.length) {
      await sql`delete from issues where id = any(${made.issues})`;
    }
    if (made.users.length) {
      await sql`delete from users where id = any(${made.users})`;
    }
    const [left] = await sql<{ n: number }[]>`
      select (select count(*) from users where email like 'check-303-%')
           + (select count(*) from issues where title like 'check-303-%')
           + (select count(*) from verification_tokens
                where identifier like 'check-303-%') as n`;
    return Number(left?.n ?? 0);
  }

  return {
    sql,
    base,
    browser,
    stamp,
    ok,
    heading,
    failures: () => failures,
    member,
    name,
    issue,
    comment,
    context,
    library,
    bellLabel,
    menuTexts,
    activeLabel,
    logged,
    nextLogged,
    shot,
    cleanup,
  };
}
