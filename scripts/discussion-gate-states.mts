// dev-discussion-gate.mts, the rest (issue #301): deep links (a reply's too),
// the off switch (with and without a settings row), drafts, the print route,
// and demo mode's signed-out visitor.
import { createHash } from "node:crypto";
import type { Page } from "playwright";
import {
  OPEN_BUTTON,
  buttonFace,
  desktopPlacement,
  type Issue,
  type Kit,
  type Member,
} from "./discussion-gate-kit.mts";
import type { Cast } from "./discussion-gate-desktop.mts";
import { heard, post } from "./discussion-gate-desktop.mts";

export async function deepLinks(
  k: Kit,
  c: Cast,
  target: string,
  gone: string,
  reply: string,
) {
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
      query: `?discussion=1&comment=${reply}`,
    });
    await k.waitThread(r.page);
    await r.page
      .waitForFunction(
        (id) => document.activeElement?.id === `comment-${id}`,
        reply,
        { timeout: 10_000 },
      )
      .catch(() => {});
    const parentToggle = r.page.locator(
      `li:has(> article#comment-${target}) > div > button[aria-expanded]`,
    );
    k.ok(
      (await parentToggle.getAttribute("aria-expanded")) === "true",
      "a link to a reply opens its parent's replies",
    );
    k.ok(
      (await r.page.evaluate(() => document.activeElement?.id)) ===
        `comment-${reply}` &&
        (await r.page.getAttribute(`#comment-${reply}`, "data-highlight")) ===
          "true",
      "and scrolls to, focuses and lights up the reply",
    );
    if (width < 768) {
      await r.page.waitForTimeout(3000);
      await r.page.evaluate(() =>
        document
          .querySelector("[role=dialog] .overflow-y-auto")
          ?.scrollTo(0, 0),
      );
      await k.shot(r.page, "phone-replies-folded-and-open");
    }
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
  return page.locator(OPEN_BUTTON).count();
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
  const control = r.page.locator(OPEN_BUTTON);
  const face = await buttonFace(r.page);
  k.ok(
    face.label === "Discussion" && face.text === "" && face.badges === 0,
    "the button carries no count",
  );
  await desktopPlacement(k, r.page);
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
  k.ok(
    (await buttonFace(r.page)).text === "",
    "the phone button carries no count either",
  );
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
