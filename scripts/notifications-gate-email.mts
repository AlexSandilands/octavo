// The reply email end to end (issue #303), for dev-notifications-gate.mts:
// replies posted through the reader, the email each one owes (or doesn't), its
// escaping and wording, and the magic link — fresh, reused, a day old.
import type { Page } from "playwright";
import type { Kit, Member } from "./notifications-gate-kit.mts";

export type Cast = {
  issue: { id: string; number: number };
  magazine: string;
  pat: Member;
  patName: string;
  patTop: string;
  house: Member;
  hughName: string;
  hughTop: string;
  rex: Member;
  rexName: string;
};

export const PAT_TOP = "check-303 Pat asks about the cover";
export const NASTY = '<script>alert("x")</script> & <b>bold</b>';

/** Posts a reply through the reader's thread as `who`; its id. */
export async function replyAs(
  k: Kit,
  who: Member,
  issueNo: number,
  parentId: string,
  body: string,
): Promise<string | null> {
  const ctx = await k.context(who);
  const page = await ctx.newPage();
  try {
    await page.goto(
      `${k.base}/read/${issueNo}?discussion=1&comment=${parentId}`,
    );
    await page.waitForSelector(`#comment-${parentId}`, { timeout: 60_000 });
    await page
      .locator(`#comment-${parentId} button[aria-label^="Reply to"]`)
      .click();
    await page.fill(`#reply-${parentId}`, body);
    await page.click(`form:has(#reply-${parentId}) button[type=submit]`);
    for (let i = 0; i < 60; i++) {
      const [row] = await k.sql<{ id: string }[]>`
        select id from comments where parent_id = ${parentId}
          and author_id = ${who.id} and body = ${body}`;
      if (row) return row.id;
      await page.waitForTimeout(250);
    }
    return null;
  } finally {
    await ctx.close();
  }
}

const count = async (k: Kit, label: string, who: Member) =>
  (await k.logged("reply", label, who.email)).length;

export async function emailGate(k: Kit, c: Cast) {
  k.heading("reply email — sent to an opted-in parent author");
  const before = {
    pat: await count(k, "email to", c.pat),
    patLinks: (await k.logged("auth", "magic link for", c.pat.email)).length,
    house: await count(k, "email to", c.house),
    rex: await count(k, "email to", c.rex),
  };
  const long = `${NASTY} ${"check-303 words ".repeat(30)}THE-END`;
  const reply1 = await replyAs(k, c.rex, c.issue.number, c.patTop, long);
  k.ok(reply1, "Rex replies to Pat's comment through the reader");
  const subject = await k.nextLogged(
    "reply",
    "email to",
    c.pat.email,
    before.pat,
  );
  const expected = `Rex Check replied to your comment on ${c.magazine} Issue ${c.issue.number}`;
  k.ok(subject === expected, `one email to Pat, subject “${subject}”`);
  k.ok(
    !subject?.includes("Rex Account") && !subject?.includes("@"),
    "the subject names the posting name — never the account name or an email",
  );
  const html = (await k.logged("reply", "html for", c.pat.email)).at(-1) ?? "";
  k.ok(
    html.includes(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;",
    ) &&
      !html.includes("<script>") &&
      !html.includes("<b>bold"),
    "the reply's markup arrives escaped in the HTML",
  );
  k.ok(
    html.includes("Pat Check wrote") &&
      html.includes(PAT_TOP) &&
      html.includes("Read the reply"),
    "it quotes Pat's comment and carries a Read the reply button",
  );
  k.ok(
    !html.includes("THE-END") && html.includes("…"),
    "the reply is cut to its first ~300 characters",
  );
  k.ok(
    html.includes("Stop reply emails") && html.includes("/unsubscribe?token="),
    "the footer carries Stop reply emails",
  );
  const link = await k.nextLogged(
    "auth",
    "magic link for",
    c.pat.email,
    before.patLinks,
  );
  const callback = link ? new URL(link).searchParams.get("callbackUrl") : null;
  k.ok(
    callback === `/read/${c.issue.number}?discussion=1&comment=${reply1}`,
    `the dev console logs the magic link to the reply (${callback})`,
  );
  k.ok(
    (await count(k, "email to", c.rex)) === before.rex,
    "the replier gets no email",
  );

  k.heading(
    "reply email — none for an author who hasn't opted in, or yourself",
  );
  const reply2 = await replyAs(
    k,
    c.rex,
    c.issue.number,
    c.hughTop,
    "check-303 to Hugh",
  );
  k.ok(reply2, "Rex replies to Hugh's comment");
  const [note] = await k.sql`select id from notifications
    where user_id = ${c.house.id} and comment_id = ${reply2}`;
  k.ok(note, "the household is notified in the bell…");
  await new Promise((r) => setTimeout(r, 1500));
  k.ok(
    (await count(k, "email to", c.house)) === before.house,
    "…but gets no email (reply emails off)",
  );
  const patNow = await count(k, "email to", c.pat);
  const self = await replyAs(
    k,
    c.pat,
    c.issue.number,
    c.patTop,
    "check-303 my own follow-up",
  );
  k.ok(self, "Pat replies under her own comment");
  const [selfNote] =
    await k.sql`select id from notifications where comment_id = ${self}`;
  await new Promise((r) => setTimeout(r, 1500));
  k.ok(
    !selfNote && (await count(k, "email to", c.pat)) === patNow,
    "no notification and no email for replying to yourself",
  );
  return { reply1: reply1!, reply2: reply2!, link: link! };
}

async function landedOn(page: Page, replyId: string) {
  try {
    await page.waitForFunction(
      (id) => document.activeElement?.id === `comment-${id}`,
      replyId,
      { timeout: 30_000 },
    );
  } catch {
    return false;
  }
  return (
    (await page.getAttribute(`#comment-${replyId}`, "data-highlight")) ===
    "true"
  );
}

async function expiredWithNext(k: Kit, page: Page, next: string) {
  await page.waitForSelector("text=That link has expired.", {
    timeout: 30_000,
  });
  const url = new URL(page.url());
  return (
    url.pathname === "/signin" &&
    url.searchParams.get("next") === next &&
    (await page.inputValue('input[name="next"]')) === next
  );
}

export async function linkGate(
  k: Kit,
  c: Cast,
  sent: { reply1: string; link: string },
) {
  k.heading("the email's link");
  const path = `/read/${c.issue.number}?discussion=1&comment=${sent.reply1}`;
  const sessions = async () =>
    Number(
      (
        await k.sql`select count(*)::int as n from sessions
      where user_id = ${c.pat.id}`
      )[0]!.n,
    );
  const had = await sessions();
  let ctx = await k.context(null);
  let page = await ctx.newPage();
  await page.goto(sent.link);
  k.ok(
    (await landedOn(page, sent.reply1)) &&
      new URL(page.url()).pathname + new URL(page.url()).search === path,
    "a session-less browser is signed in and lands on the reply, lit up",
  );
  k.ok((await sessions()) === had + 1, "as Pat (a new session row)");
  await ctx.close();

  ctx = await k.context(null);
  page = await ctx.newPage();
  await page.goto(sent.link);
  k.ok(
    await expiredWithNext(k, page, path),
    "the used link → “That link has expired.”, the reply kept as ?next",
  );
  await ctx.close();

  ctx = await k.context(c.pat);
  page = await ctx.newPage();
  await page.goto(sent.link);
  k.ok(
    await landedOn(page, sent.reply1),
    "clicked again while signed in, it just opens the reply",
  );
  await ctx.close();

  // A second reply, its link left a day to lapse.
  const before = (await k.logged("auth", "magic link for", c.pat.email)).length;
  const reply = await replyAs(
    k,
    c.rex,
    c.issue.number,
    c.patTop,
    "check-303 later",
  );
  const stale = await k.nextLogged(
    "auth",
    "magic link for",
    c.pat.email,
    before,
  );
  await k.sql`update verification_tokens set expires = now() - interval '1 minute'
    where identifier = ${c.pat.email}`;
  ctx = await k.context(null);
  page = await ctx.newPage();
  await page.goto(stale!);
  k.ok(
    await expiredWithNext(
      k,
      page,
      `/read/${c.issue.number}?discussion=1&comment=${reply}`,
    ),
    "a day-old link → the same expired sign-in, its reply kept as ?next",
  );
  await ctx.close();
}
