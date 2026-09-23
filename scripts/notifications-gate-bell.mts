// The library bell (issue #303), for dev-notifications-gate.mts: the count and
// menu for the parent author only, the shared account's wording, choosing an
// entry, Mark all read, hidden replies dropping out, the newest-20 cap, and
// no bell while discussion is off or for demo mode's signed-out visitor.
import type { Page } from "playwright";
import type { Cast } from "./notifications-gate-email.mts";
import {
  BELL,
  MENU,
  type Kit,
  type Member,
} from "./notifications-gate-kit.mts";

const ITEMS = `${MENU} a[role=menuitem]`;

async function openMenu(page: Page) {
  await page.click(BELL);
  await page.waitForSelector(MENU);
}

const unreadNotes = async (k: Kit, who: Member) =>
  Number(
    (
      await k.sql`select count(*)::int as n from notifications
    where user_id = ${who.id} and read_at is null`
    )[0]!.n,
  );

export async function bellGate(k: Kit, c: Cast, reply1: string) {
  const n = c.issue.number;
  k.heading("the bell — the parent author's, not the replier's");
  let { ctx, page } = await k.library(c.pat);
  k.ok(
    (await k.bellLabel(page)) === "Notifications, 1 unread",
    `Pat's bell reads “${await k.bellLabel(page)}”`,
  );
  const box = await page.locator(BELL).boundingBox();
  k.ok(
    box && Math.round(box.width) === 44 && Math.round(box.height) === 44,
    "the bell is 44px",
  );
  k.ok(
    (await page.locator(`${BELL} span`).textContent())?.trim() === "1",
    "its badge shows 1",
  );
  await openMenu(page);
  let texts = await k.menuTexts(page);
  k.ok(
    texts[0]?.startsWith(`Rex Check replied to your comment on Issue ${n}, `) &&
      texts[0].endsWith(", unread") &&
      /ago|now/.test(texts[0]),
    `the menu lists it, unread, with a relative time (“${texts[0]}”)`,
  );
  k.ok(texts.at(-1) === "Mark all read", "Mark all read sits at the foot");

  const rex = await k.library(c.rex);
  k.ok(
    (await k.bellLabel(rex.page)) === "Notifications",
    "the replier's bell has no count",
  );
  await openMenu(rex.page);
  k.ok(
    (await k.menuTexts(rex.page))[0]?.startsWith("No replies yet"),
    "and an empty menu says so",
  );
  await rex.ctx.close();

  const house = await k.library(c.house);
  await openMenu(house.page);
  k.ok(
    (await k.menuTexts(house.page))[0]?.includes(
      `Rex Check replied to Hugh Check’s comment on Issue ${n}`,
    ),
    "a shared account (two names) is told whose comment it was",
  );
  await house.ctx.close();

  k.heading("choosing one opens the thread on the reply and marks it read");
  await page.keyboard.press("Enter");
  await page.waitForURL(`**/read/${n}?discussion=1&comment=${reply1}`, {
    timeout: 60_000,
  });
  const landed = await page
    .waitForFunction(
      (id) => document.activeElement?.id === `comment-${id}`,
      reply1,
      {
        timeout: 30_000,
      },
    )
    .then(() => page.getAttribute(`#comment-${reply1}`, "data-highlight"))
    .catch(() => null);
  k.ok(landed === "true", "Enter on it opens the thread, on the reply, lit up");
  k.ok((await unreadNotes(k, c.pat)) === 0, "and it is marked read");
  await page.goto(`${k.base}/`);
  await page.waitForSelector(BELL);
  k.ok(
    (await k.bellLabel(page)) === "Notifications",
    "back in the library, no count",
  );
  await openMenu(page);
  texts = await k.menuTexts(page);
  k.ok(
    !texts[0]?.endsWith(", unread"),
    "and the entry is no longer marked unread",
  );

  k.heading("Mark all read");
  const replies: string[] = [];
  for (const [i, ago] of ["5 minutes", "4 minutes", "3 minutes"].entries()) {
    replies.push(
      await k.comment(c.issue.id, c.rex, c.rexName, `check-303 more ${i}`, {
        parentId: c.patTop,
        ago,
        notify: c.pat.id,
      }),
    );
  }
  await page.reload();
  await page.waitForSelector(BELL);
  k.ok(
    (await k.bellLabel(page)) === "Notifications, 3 unread",
    "three more replies: 3 unread",
  );
  await openMenu(page);
  await page.click(`${MENU} button:has-text("Mark all read")`);
  await page.waitForFunction(
    (sel) =>
      document.querySelector(sel)?.getAttribute("aria-label") ===
      "Notifications",
    BELL,
    { timeout: 30_000 },
  );
  k.ok(
    (await page.locator("header [role=status]").textContent()) ===
      "All notifications marked read.",
    "Mark all read clears the count and says so",
  );
  k.ok(
    (await unreadNotes(k, c.pat)) === 0,
    "every notification is read in the database",
  );
  await ctx.close();

  k.heading("a hidden or deleted reply drops out");
  const hidden = await k.comment(
    c.issue.id,
    c.rex,
    c.rexName,
    "check-303 to hide",
    {
      parentId: c.patTop,
      ago: "2 minutes",
      notify: c.pat.id,
    },
  );
  const deleted = await k.comment(
    c.issue.id,
    c.rex,
    c.rexName,
    "check-303 to delete",
    {
      parentId: c.patTop,
      ago: "1 minute",
      notify: c.pat.id,
    },
  );
  ({ ctx, page } = await k.library(c.pat));
  k.ok(
    (await k.bellLabel(page)) === "Notifications, 2 unread",
    "two new replies count",
  );
  await k.sql`update comments set hidden_at = now() where id = ${hidden}`;
  await k.sql`update comments set deleted_at = now(), deleted_by = 'author', body = ''
    where id = ${deleted}`;
  await page.reload();
  await page.waitForSelector(BELL);
  k.ok(
    (await k.bellLabel(page)) === "Notifications",
    "hidden and deleted: neither counts",
  );
  await openMenu(page);
  texts = await k.menuTexts(page);
  k.ok(
    texts.length === 5 && texts.every((t) => !t.endsWith(", unread")),
    "and neither is listed (the four read ones and Mark all read remain)",
  );
  await ctx.close();

  k.heading("the newest 20, at both widths");
  await k.sql`update notifications set created_at = created_at - interval '1 hour'
    where user_id = ${c.pat.id}`;
  for (let i = 0; i < 25; i++) {
    await k.comment(c.issue.id, c.rex, c.rexName, `check-303 flood ${i}`, {
      parentId: c.patTop,
      ago: `${40 - i} seconds`,
      notify: c.pat.id,
    });
  }
  for (const width of [1280, 390]) {
    ({ ctx, page } = await k.library(c.pat, width));
    k.ok(
      (await k.bellLabel(page)) === "Notifications, 25 unread",
      `${width}px: 25 unread`,
    );
    await openMenu(page);
    k.ok(
      (await page.locator(ITEMS).count()) === 20,
      "the menu lists the newest 20",
    );
    const first = await page.locator(ITEMS).first().getAttribute("href");
    const [newest] =
      await k.sql`select c.id from notifications n join comments c
      on c.id = n.comment_id where n.user_id = ${c.pat.id}
      order by n.created_at desc limit 1`;
    k.ok(first?.endsWith(`comment=${newest!.id}`), "newest first");
    const menu = await page.locator(MENU).boundingBox();
    k.ok(
      menu && menu.x >= 0 && menu.x + menu.width <= width + 0.5,
      `it stays on screen (${Math.round(menu?.x ?? -1)}–${Math.round((menu?.x ?? 0) + (menu?.width ?? 0))}px)`,
    );
    await k.shot(page, `bell-menu-${width}`);
    await ctx.close();
  }
}

export async function offGate(k: Kit, c: Cast) {
  k.heading("no bell while discussion is off");
  await k.sql`update settings set comments_enabled = false where id = 1`;
  try {
    const { ctx, page } = await k.library(c.pat);
    k.ok((await page.locator(BELL).count()) === 0, "switched off: no bell");
    await ctx.close();
  } finally {
    await k.sql`update settings set comments_enabled = true where id = 1`;
  }
  const { ctx, page } = await k.library(c.pat);
  k.ok(
    (await page.locator(BELL).count()) === 1,
    "switched back on: the bell returns",
  );
  await ctx.close();
}

export async function demoGate(k: Kit) {
  k.heading("demo mode's signed-out visitor");
  const { ctx, page } = await k.library(null);
  k.ok(
    (await page.locator(BELL).count()) === 0,
    "no bell for the null visitor",
  );
  k.ok(
    (await page.locator("header nav").textContent())?.includes("Demo"),
    "the demo chip stands in the header instead",
  );
  await ctx.close();
}
