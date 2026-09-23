// dev-discussion-gate.mts, the rest (issue #301): the first post that brings
// its own name, a refused name, the rate limit, deep links, the off switch
// (with and without a settings row), drafts, the print route, the counts on
// the library cards and in the admin's delete confirmations, and demo mode's
// signed-out visitor.
import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { Issue, Kit, Member } from "./discussion-gate-kit.mts";
import type { Cast } from "./discussion-gate-desktop.mts";
import { heard, post } from "./discussion-gate-desktop.mts";

export async function composerStates(k: Kit, c: Cast) {
  k.heading("composer — a first post brings its own name");
  const bob = await k.member("bob", { name: "Bob Newcomer" });
  let r = await k.reader(bob, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  const field = r.page.locator("#discussion-composer-name");
  k.ok(
    (await r.page
      .locator("label[for=discussion-composer-name]")
      .textContent()) === "Choose the name other members will see",
    "with no names, the composer asks for one",
  );
  k.ok(
    (await field.inputValue()) === "Bob Newcomer",
    "suggested from users.name",
  );
  const before = await post(r.page, "check-301 my first post");
  k.ok(
    await heard(r.page, "Your comment is posted.", before),
    "the first post goes through",
  );
  const names =
    await k.sql`select id, name from member_names where user_id = ${bob.id}`;
  k.ok(
    names.length === 1 && names[0]!.name === "Bob Newcomer",
    "and creates that name",
  );
  k.ok(
    await r.page
      .locator('article[aria-label="Comment by Bob Newcomer"]')
      .isVisible(),
    "the comment shows under it",
  );
  k.ok(
    (await r.page.locator("text=Posting as").count()) > 0 &&
      (await r.page
        .locator('a:has-text("Add a name")')
        .getAttribute("href")) === "/profile",
    "the composer now reads “Posting as” with an Add a name link",
  );
  await r.ctx.close();

  k.heading("composer — a first post refused after its name was made");
  // The server refuses the comment once the name exists. Stripping the box's
  // maxlength (as a crafted client could) makes that refusal repeatable.
  const second = await k.member("second", { name: "Sam Second" });
  r = await k.reader(second, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  await r.page.evaluate(() =>
    document
      .querySelector("#discussion-composer")
      ?.removeAttribute("maxlength"),
  );
  const long = "x".repeat(2001);
  await post(r.page, long);
  await r.page.waitForSelector("#discussion-composer-error");
  const refusal =
    (await r.page.textContent("#discussion-composer-error")) ?? "";
  k.ok(
    refusal !== "" && !refusal.includes("Choose one of your names"),
    `the refusal is shown (“${refusal}”)`,
  );
  const made =
    await k.sql`select id from member_names where user_id = ${second.id}`;
  k.ok(made.length === 1, "the name was created");
  await r.page.waitForSelector("#discussion-composer-name", {
    state: "detached",
  });
  k.ok(
    (await r.page.locator("text=Posting as").count()) > 0,
    "the composer moves on to “Posting as” it",
  );
  k.ok(
    (await r.page.inputValue("#discussion-composer")) === long,
    "the draft is still in the box",
  );
  const again = await post(r.page, "check-301 carried on");
  k.ok(
    await heard(r.page, "Your comment is posted.", again),
    "a second submit goes through",
  );
  const [carried] = await k.sql`select author_name_id from comments
    where author_id = ${second.id}`;
  k.ok(
    carried?.author_name_id === made[0]!.id,
    "under the name the first try made",
  );
  await r.ctx.close();

  k.heading("composer — a refused name, an empty post");
  const newbie = await k.member("newbie");
  r = await k.reader(newbie, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  await r.page.click("form:has(#discussion-composer) button[type=submit]");
  k.ok(
    (await r.page.locator("#discussion-composer-error").textContent()) ===
      "Write something first.",
    "an empty post is refused inline",
  );
  await r.page.fill("#discussion-composer-name", "Admin");
  await post(r.page, "check-301 should not post");
  await r.page.waitForSelector("#discussion-composer-name-error");
  k.ok(
    (await r.page.textContent("#discussion-composer-name-error")) ===
      "That name is reserved. Choose another.",
    "a refused name shows the validator's reason",
  );
  const [none] =
    await k.sql`select count(*)::int as n from comments where author_id = ${newbie.id}`;
  k.ok(none?.n === 0, "and nothing is posted");
  await r.ctx.close();

  k.heading("composer — the rate limit");
  const fast = await k.member("fast", { name: "Fast Poster" });
  await k.name(fast.id, "Fast Poster");
  r = await k.reader(fast, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  for (let i = 0; i < 10; i++) {
    await post(r.page, `check-301 quick ${i}`);
    await r.page.waitForFunction(
      () =>
        (document.querySelector("#discussion-composer") as HTMLTextAreaElement)
          ?.value === "",
      undefined,
      { timeout: 15_000 },
    );
  }
  await post(r.page, "check-301 one too many");
  await r.page.waitForSelector("#discussion-composer-error");
  k.ok(
    (await r.page.textContent("#discussion-composer-error")) ===
      "You're posting quickly — try again in a few minutes.",
    "the eleventh post in ten minutes is slowed down, in words",
  );
  await r.ctx.close();
}

export async function deepLinks(k: Kit, c: Cast, target: string, gone: string) {
  for (const width of [1280, 390]) {
    k.heading(`deep links — ${width}px`);
    let r = await k.reader(c.carol, c.issue.number!, {
      width,
      query: "?discussion=1",
    });
    await k.waitThread(r.page);
    k.ok(
      await k.shell(r.page).isVisible(),
      "?discussion=1 opens the shell on load",
    );
    await r.page.goBack();
    await r.page.waitForSelector("[role=dialog]", { state: "detached" });
    k.ok(
      r.page.url().endsWith("?discussion=1"),
      "Back closes it and stays on the issue",
    );
    await r.ctx.close();

    r = await k.reader(c.carol, c.issue.number!, {
      width,
      query: `?discussion=1&comment=${target}`,
    });
    await k.waitThread(r.page);
    const el = r.page.locator(`#comment-${target}`);
    await r.page.waitForFunction(
      (id) => document.activeElement?.id === `comment-${id}`,
      target,
      { timeout: 10_000 },
    );
    const inView = await el.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const list = node.closest(".overflow-y-auto")!.getBoundingClientRect();
      return box.top >= list.top - 1 && box.bottom <= list.bottom + 1;
    });
    k.ok(inView, "&comment= scrolls to that comment and focuses it");
    k.ok(
      (await el.getAttribute("data-highlight")) === "true",
      "and lights it up",
    );
    await r.page.waitForTimeout(3000);
    k.ok((await el.getAttribute("data-highlight")) === null, "briefly");
    await k.shot(r.page, `deep-link-${width}`);
    await r.ctx.close();

    r = await k.reader(c.carol, c.issue.number!, {
      width,
      query: `?discussion=1&comment=${gone}`,
    });
    await k.waitThread(r.page);
    k.ok(
      await heard(r.page, "That comment is no longer in the discussion."),
      "a deleted comment's link says so",
    );
    const top = await r.page.evaluate(
      () => document.querySelector("[role=dialog] .overflow-y-auto")?.scrollTop,
    );
    k.ok(top === 0, "and opens the thread at its top");
    await r.ctx.close();
  }
}

async function controls(page: Page) {
  return page
    .locator('button[title="Discussion"], button[aria-label^="Discussion"]')
    .count();
}

export async function offSwitch(k: Kit, c: Cast, draft: Issue) {
  const check = async (why: string) => {
    for (const width of [1280, 390]) {
      const r = await k.reader(c.alice, c.issue.number!, {
        width,
        query: "?discussion=1",
      });
      await r.page.waitForTimeout(800);
      k.ok(
        (await controls(r.page)) === 0 &&
          !(await r.page.isVisible("[role=dialog]")),
        `${why}: no control and nothing opens at ${width}px`,
      );
      await r.ctx.close();
    }
    const res = await fetch(`${k.base}/api/issues/${c.issue.number}/comments`, {
      headers: { cookie: `authjs.session-token=${c.alice.token}` },
    });
    k.ok(res.status === 403, `${why}: the list route refuses (${res.status})`);
    const home = await fetchHtml(k, c.alice, "/");
    k.ok(!/\d+ comments?\b/.test(home), `${why}: no counts on the library`);
  };

  k.heading("off switch — switched off, then with no settings row");
  const [row] = await k.sql`select * from settings where id = 1`;
  const open = await k.reader(c.alice, c.issue.number!, {
    query: "?discussion=1",
  });
  await k.waitThread(open.page);
  await k.sql`update settings set comments_enabled = false where id = 1`;
  try {
    await post(open.page, "check-301 after the switch");
    await open.page.waitForSelector("#discussion-composer-error");
    k.ok(
      (await open.page.textContent("#discussion-composer-error")) ===
        "Discussion is turned off at the moment.",
      "a post into a thread switched off meanwhile says so, inline",
    );
    await open.ctx.close();
    await check("off");
    await k.sql`delete from settings where id = 1`;
    await check("no settings row");
  } finally {
    await k.sql`delete from settings where id = 1`;
    if (row)
      await k.sql`insert into settings ${k.sql(row as Record<string, unknown>)}`;
  }
  const [back] =
    await k.sql`select comments_enabled from settings where id = 1`;
  k.ok(
    back?.comments_enabled === true,
    "the settings row is restored as found",
  );

  k.heading("drafts and the print route");
  const ctx = await k.context(c.ada);
  const page = await ctx.newPage();
  await page.goto(`${k.base}/admin/issues/${draft.id}/preview`);
  await page.waitForSelector('[aria-label="Zoom page"]', { timeout: 60_000 });
  await page.waitForTimeout(500);
  k.ok((await controls(page)) === 0, "a draft's preview has no discussion");
  await ctx.close();
  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  const print = await (
    await fetch(`${k.base}/read/${c.issue.number}/print?token=${token}`)
  ).text();
  k.ok(print.includes("pdf-page"), "the print route renders the issue");
  k.ok(
    !print.includes("check-301") &&
      !/Discussion|Posting as|comment-/.test(print),
    "and carries no thread markup",
  );
}

export async function fetchHtml(k: Kit, who: Member | null, path: string) {
  const headers: Record<string, string> = who
    ? { cookie: `authjs.session-token=${who.token}` }
    : {};
  return (await fetch(`${k.base}${path}`, { headers })).text();
}

export async function demoGate(k: Kit, c: Cast) {
  k.heading("demo mode — the signed-out visitor");
  const n = c.issue.number!;
  let r = await k.reader(null, n);
  const control = r.page.locator('button[title="Discussion"]');
  k.ok(
    (await control.getAttribute("aria-label")) === "Discussion",
    "the dock control carries no count",
  );
  k.ok((await control.locator("span").count()) === 0, "and no badge");
  await control.click();
  await r.page.waitForSelector("text=Discussion is for members.");
  const link = r.page.locator(
    '[role=dialog] a:has-text("Sign in to join the discussion")',
  );
  k.ok(
    (await link.getAttribute("href")) ===
      `/signin?next=${encodeURIComponent(`/read/${n}?discussion=1`)}`,
    "the only thing in it is the sign-in button, back to this issue's discussion",
  );
  const lb = await link.boundingBox();
  k.ok(lb && lb.height >= 44, `the button is 44px tall (${lb?.height})`);
  k.ok(
    (await r.page
      .locator("[role=dialog] article, [role=dialog] textarea")
      .count()) === 0,
    "no comments and no composer",
  );
  k.ok(r.listCalls() === 0, "and nothing was fetched");
  await k.shot(r.page, "demo-desktop");
  await r.ctx.close();

  r = await k.reader(null, n, {
    width: 390,
    height: 844,
    query: "?discussion=1",
  });
  await r.page.waitForSelector("text=Discussion is for members.");
  const fab = r.page.locator('button[aria-label="Discussion"]');
  k.ok((await fab.count()) === 1, "the phone button carries no count either");
  k.ok(r.listCalls() === 0, "the deep link fetched nothing");
  await k.shot(r.page, "demo-phone");
  await r.ctx.close();

  const res = await fetch(`${k.base}/api/issues/${n}/comments`);
  k.ok(res.status === 401, `the list route answers 401 (${res.status})`);
  for (const path of ["/", "/archive"]) {
    k.ok(
      !/\d+ comments?\b/.test(await fetchHtml(k, null, path)),
      `no counts on ${path}`,
    );
  }
}
