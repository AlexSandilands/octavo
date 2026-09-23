// dev-discussion-gate.mts, the admin's thread (issue #302): hidden comments
// greyed with their words and a Hidden pill, deleted stubs marked, the
// account line (only when it differs from the name) and its link, Hide /
// Unhide / Delete from the drawer and the sheet — resolving reports as the
// inbox does — and the member's payload held to the members' rule before and
// after, derived from the database rather than a stored snapshot.
import type { Page } from "playwright";
import type { Cast } from "./discussion-gate-desktop.mts";
import { heard, said } from "./discussion-gate-desktop.mts";
import type { Kit, Member } from "./discussion-gate-kit.mts";

type Row = {
  id: string;
  parent_id: string | null;
  body: string;
  hidden_at: Date | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  created_at: Date;
  edited_at: Date | null;
  author_id: string | null;
  name: string | null;
  badge: boolean | null;
  avatar_key: string | null;
  is_admin: boolean | null;
};

const rowsOf = (k: Kit, issueId: string) => k.sql<Row[]>`
  select c.id, c.parent_id, c.body, c.hidden_at, c.deleted_at, c.deleted_by,
    c.created_at, c.edited_at, c.author_id, n.name, n.badge,
    i.key as avatar_key, u.is_admin
  from comments c
  left join member_names n on n.id = c.author_name_id
  left join images i on i.id = n.avatar_image_id
  left join users u on u.id = c.author_id
  where c.issue_id = ${issueId}
  order by c.created_at, c.id`;

// The members' rule (epic #298), written out from the rows: removed comments
// are invisible, except a removed top-level comment with visible replies,
// which is a bare stub. Keys in the order the thread has always sent them.
async function memberRule(k: Kit, issueId: string, viewerId: string) {
  const rows = await rowsOf(k, issueId);
  const removed = (r: Row) => r.hidden_at !== null || r.deleted_at !== null;
  const view = (r: Row) => {
    if (r.avatar_key) throw new Error("the admin fixtures use no avatars");
    const name = r.author_id !== null ? r.name : null;
    return {
      id: r.id,
      body: r.body,
      name: name ?? "Former member",
      avatarUrl: null,
      badge: name !== null && r.badge === true && r.is_admin === true,
      isMine: r.author_id === viewerId,
      former: name === null,
      createdAt: r.created_at.toISOString(),
      editedAt: r.edited_at?.toISOString() ?? null,
    };
  };
  const entries: unknown[] = [];
  for (const top of rows.filter((r) => !r.parent_id)) {
    const replies = rows
      .filter((r) => r.parent_id === top.id && !removed(r))
      .map(view);
    if (!removed(top)) entries.push({ ...view(top), removed: false, replies });
    else if (replies.length > 0) {
      const createdAt = top.created_at.toISOString();
      entries.push({ id: top.id, removed: true, createdAt, replies });
    }
  }
  return JSON.stringify(entries);
}

async function payload(k: Kit, who: Member, n: number) {
  const res = await fetch(`${k.base}/api/issues/${n}/comments`, {
    headers: { cookie: `authjs.session-token=${who.token}` },
  });
  return (await res.json()) as {
    viewer: string;
    entries: {
      id: string;
      replies: Record<string, unknown>[];
      [key: string]: unknown;
    }[];
  };
}

async function memberHoldsToRule(k: Kit, c: Cast, id: string, n: number) {
  const got = await payload(k, c.carol, n);
  const want = await memberRule(k, id, c.carol.id);
  return got.viewer === "member" && JSON.stringify(got.entries) === want;
}

const art = (page: Page, id: string) => page.locator(`#comment-${id}`);

async function focusedLabel(page: Page) {
  return page.evaluate(
    () =>
      document.activeElement?.getAttribute("aria-label") ??
      document.activeElement?.id ??
      "",
  );
}

// The greyed comment's words against the surface they sit on. The colours
// are read in the page and compared here (tsx's helpers don't reach it).
const lum = (css: string) => {
  const [r, g, b] = css
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
async function bodyContrast(page: Page, id: string) {
  const { fg, bg } = await art(page, id).evaluate((el) => ({
    fg: getComputedStyle(el.querySelector("p.mt-1")!).color,
    bg: getComputedStyle(el).backgroundColor,
  }));
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function confirmDelete(k: Kit, page: Page, id: string, label: string) {
  await art(page, id).locator(`button[aria-label="${label}"]`).click();
  await page.waitForSelector("[role=dialog] [role=dialog]");
  k.ok(
    (await page.locator("[role=dialog] [role=dialog] h2").textContent()) ===
      "Delete this comment?",
    "Delete asks first, in a dialog over the thread",
  );
}

export async function adminGate(k: Kit, c: Cast) {
  // Numbered below the counts section's issues, so theirs stays the latest.
  const x = await k.issue(true, -2);
  const n = x.number!;
  const nameless = await k.member("nameless", { name: null });
  const noraName = await k.name(nameless.id, "Nora Nameless");
  const carolName = (
    await k.sql`select id from member_names where user_id = ${c.carol.id} limit 1`
  )[0]!.id as string;
  const alice = c.aliceNames[0];
  const say = (
    m: Member,
    name: string,
    body: string,
    ago: string,
    parentId?: string,
  ) => k.comment(x.id, m, name, `check-302 ${body}`, { ago, parentId });
  const t1 = await say(c.carol, carolName, "plain words", "6 hours");
  const r2 = await say(
    c.alice,
    alice,
    "a hidden reply",
    "5 hours 50 minutes",
    t1,
  );
  const t2 = await say(c.alice, alice, "to be hidden", "5 hours");
  await say(c.carol, carolName, "a reply that stays", "4 hours 30 minutes", t2);
  const t3 = await say(nameless, noraName, "already hidden", "4 hours");
  const t4 = await say(c.alice, alice, "gone by its author", "3 hours");
  await say(c.carol, carolName, "a reply to it", "2 hours 50 minutes", t4);
  const t5 = await say(c.ada, c.adaName, "the admin's own", "2 hours");
  const t6 = await say(c.carol, carolName, "delete me whole", "1 hour");
  const t7 = await say(c.alice, alice, "delete me, keep replies", "50 minutes");
  await say(c.carol, carolName, "a reply to keep", "40 minutes", t7);
  await k.sql`update comments set hidden_at = now() where id in ${k.sql([r2, t3])}`;
  await k.sql`update comments set body = '', deleted_at = now(),
    deleted_by = 'author' where id = ${t4}`;
  const [report] = await k.sql`insert into comment_reports (id, comment_id,
      issue_id, reporter_id, reason, snapshot_body, snapshot_name,
      snapshot_author_id, snapshot_created_at)
    values (${crypto.randomUUID()}, ${t2}, ${x.id}, ${c.carol.id}, 'offensive',
      'check-302 to be hidden', 'Alice Reader', ${c.alice.id}, now())
    returning id`;

  k.heading("admin — the payloads");
  k.ok(
    await memberHoldsToRule(k, c, x.id, n),
    "a member's payload is exactly the members' rule (hidden and deleted rows withheld, one stub)",
  );
  const admin = await payload(k, c.ada, n);
  const rows = await rowsOf(k, x.id);
  const sent = new Map(
    admin.entries.flatMap((e) => [e, ...e.replies]).map((v) => [v.id, v]),
  );
  k.ok(
    admin.viewer === "admin" && sent.size === rows.length,
    `an admin gets every row, removed replies included (${sent.size} of ${rows.length})`,
  );
  k.ok(
    rows.every((r) => {
      const v = sent.get(r.id);
      return (
        v?.hidden === (r.hidden_at !== null) &&
        v?.deleted === (r.deleted_at !== null) &&
        v?.deletedBy === (r.deleted_at ? r.deleted_by : null)
      );
    }),
    "each marked hidden / deleted / deletedBy as stored",
  );
  const raw = JSON.stringify(admin);
  k.ok(
    !raw.includes("@example.invalid") && !raw.includes(c.alice.id),
    "with no email and no account id in it",
  );

  await desktop(k, c, { n, t1, r2, t2, t3, t4, t5, t6, report: report!.id });
  await phone(k, c, { n, t1, t7 });

  k.heading("admin — members see no change");
  k.ok(
    await memberHoldsToRule(k, c, x.id, n),
    "after the admin's writes the member's payload is still exactly the rule",
  );
  const m = await k.reader(c.carol, n, { query: "?discussion=1" });
  await k.waitThread(m.page);
  const dialog = k.shell(m.page);
  k.ok(
    (await dialog.locator("text=Comment removed").count()) === 3 &&
      (await dialog.locator("[data-moderation]").count()) === 0 &&
      (await dialog.locator("text=Account:").count()) === 0 &&
      (await dialog.locator('button[aria-label^="Hide"]').count()) === 0,
    "three “Comment removed” stubs (hidden, author-deleted, admin-deleted); no pill, no account, no Hide",
  );
  k.ok(
    (await art(m.page, t2).count()) === 0 &&
      (await art(m.page, t3).count()) === 0,
    "the hidden comments are not there at all",
  );
  await m.ctx.close();

  k.heading("admin — the reports inbox agrees");
  const inbox = await (await k.context(c.ada)).newPage();
  await inbox.goto(
    `${k.base}/admin/reports?filter=all&q=${encodeURIComponent("check-302 to be hidden")}`,
  );
  const row = inbox.locator("article", { hasText: "check-302 to be hidden" });
  await row.waitFor();
  k.ok(
    (await row.locator("text=Removed by an admin since").count()) === 1 &&
      (await row.locator("text=Resolved").count()) >= 1,
    "the report shows the comment removed by an admin, and resolved",
  );
  await inbox.context().close();
}

type Ids = Record<
  "t1" | "r2" | "t2" | "t3" | "t4" | "t5" | "t6" | "report",
  string
> & {
  n: number;
};

async function desktop(k: Kit, c: Cast, ids: Ids) {
  k.heading("admin — the drawer");
  const { page, ctx } = await k.reader(c.ada, ids.n, {
    query: "?discussion=1",
  });
  await k.waitThread(page);
  const t3 = art(page, ids.t3);
  k.ok(
    (await t3.getAttribute("data-moderation")) === "hidden" &&
      (await t3.locator(`text="Hidden"`).isVisible()) &&
      (await t3.locator("text=check-302 already hidden").isVisible()),
    "a hidden comment shows greyed, with its words and a “Hidden” pill",
  );
  const ratio = await bodyContrast(page, ids.t3);
  k.ok(ratio >= 4.5, `its words still read at ${ratio.toFixed(2)}:1 (≥ 4.5)`);
  k.ok(
    (await t3.locator("text=Account: no name on record").count()) === 1 &&
      (await t3.locator("a").count()) === 0,
    "an account with no name says so, with nothing to link by",
  );
  const t4 = art(page, ids.t4);
  k.ok(
    (await t4.getAttribute("data-moderation")) === "deleted" &&
      (await t4.locator("text=Deleted by its author.").isVisible()) &&
      (await t4.locator("button").count()) === 0,
    "a deleted comment is a “Deleted” stub with nothing to press",
  );
  k.ok(
    (await art(page, ids.t1).locator("text=Account:").count()) === 0,
    "no account line when the account's name is the posting name",
  );
  const link = art(page, ids.t2).locator("a");
  const box = await link.boundingBox();
  k.ok(
    (await link.textContent()) === "Alice Check" &&
      (await link.getAttribute("href")) === "/admin/members?q=Alice%20Check" &&
      box !== null &&
      box.height >= 44,
    `a different one reads “Account: Alice Check”, linked to the members list (${box?.height}px tall)`,
  );
  k.ok(
    !(await k.shell(page).innerHTML()).includes("@example.invalid"),
    "no email anywhere in the thread",
  );
  const own = art(page, ids.t5);
  const labels = await own
    .locator("button")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
  k.ok(
    JSON.stringify(labels) ===
      JSON.stringify([
        "Reply to Ada Editor’s comment",
        "Edit your comment",
        "Delete your comment",
        "Hide your comment",
      ]),
    `the admin's own comment: Reply, Edit, Delete and Hide (${labels.join(", ")})`,
  );
  await page
    .locator(
      `li:has(> article#comment-${ids.t1}) > div > button[aria-expanded]`,
    )
    .click();
  k.ok(
    (await art(page, ids.r2).getAttribute("data-moderation")) === "hidden",
    "a hidden reply is listed too, marked",
  );
  await t3.scrollIntoViewIfNeeded();
  await k.shot(page, "admin-desktop-thread");

  const t2 = art(page, ids.t2);
  let before = await said(page);
  await t2.locator('button[aria-label="Hide Alice Reader’s comment"]').click();
  k.ok(
    await heard(page, "Comment hidden from members.", before),
    "Hide is announced",
  );
  const [hid] =
    await k.sql`select hidden_at from comments where id = ${ids.t2}`;
  const [rep] = await k.sql`select status, resolved_by from comment_reports
    where id = ${ids.report}`;
  k.ok(hid?.hidden_at !== null, "the comment is hidden");
  k.ok(
    rep?.status === "resolved" && rep?.resolved_by === c.ada.id,
    "and its open report resolved, by this admin",
  );
  k.ok(
    (await t2.getAttribute("data-moderation")) === "hidden" &&
      (await t2.locator('button[aria-label^="Reply to"]').count()) === 0,
    "it greys, and takes no reply now",
  );
  k.ok(
    (await focusedLabel(page)) === "Unhide Alice Reader’s comment",
    "focus stays on the button, now Unhide",
  );
  before = await said(page);
  await page.keyboard.press("Enter");
  k.ok(
    await heard(page, "Comment shown again.", before),
    "Unhide, by keyboard, is announced",
  );
  const [shown] =
    await k.sql`select hidden_at from comments where id = ${ids.t2}`;
  k.ok(shown?.hidden_at === null, "the comment is visible again");
  before = await said(page);
  await page.keyboard.press("Enter");
  await heard(page, "Comment hidden from members.", before);

  await confirmDelete(k, page, ids.t6, "Delete Carol Check’s comment");
  await k.shot(page, "admin-desktop-confirm");
  before = await said(page);
  await page.click(
    '[role=dialog] [role=dialog] button:has-text("Delete comment")',
  );
  k.ok(
    await heard(page, "Comment deleted.", before),
    "the delete is announced",
  );
  const gone = await k.sql`select id from comments where id = ${ids.t6}`;
  k.ok(
    gone.length === 0 && (await art(page, ids.t6).count()) === 0,
    "a comment with no replies is gone",
  );
  await page
    .waitForFunction(
      () => document.activeElement?.id === "discussion-composer",
      null,
      { timeout: 3000 },
    )
    .catch(() => {});
  k.ok(
    (await page.evaluate(() => document.activeElement?.id)) ===
      "discussion-composer",
    "focus goes back to the box",
  );
  await ctx.close();
}

async function phone(
  k: Kit,
  c: Cast,
  ids: { n: number; t1: string; t7: string },
) {
  k.heading("admin — the sheet at 390px");
  const { page, ctx } = await k.reader(c.ada, ids.n, {
    width: 390,
    height: 844,
    query: "?discussion=1",
  });
  await k.waitThread(page);
  await page.waitForTimeout(350);
  const t1 = art(page, ids.t1);
  let before = await said(page);
  await t1.locator('button[aria-label="Hide Carol Check’s comment"]').click();
  k.ok(
    await heard(page, "Comment hidden from members.", before),
    "Hide works in the sheet",
  );
  const hideBox = await t1
    .locator('button[aria-label^="Unhide"]')
    .boundingBox();
  k.ok(
    hideBox !== null && hideBox.height >= 44 && hideBox.width >= 44,
    `Unhide is a 44px target (${hideBox?.width}×${hideBox?.height})`,
  );
  await t1.scrollIntoViewIfNeeded();
  await k.shot(page, "admin-phone-hidden");
  before = await said(page);
  await t1.locator('button[aria-label="Unhide Carol Check’s comment"]').click();
  k.ok(await heard(page, "Comment shown again.", before), "and Unhide");
  const [t1row] =
    await k.sql`select hidden_at from comments where id = ${ids.t1}`;
  k.ok(t1row?.hidden_at === null, "leaving it visible");

  await confirmDelete(k, page, ids.t7, "Delete Alice Reader’s comment");
  await k.shot(page, "admin-phone-confirm");
  before = await said(page);
  await page.click(
    '[role=dialog] [role=dialog] button:has-text("Delete comment")',
  );
  k.ok(
    await heard(page, "Comment deleted.", before),
    "Delete works in the sheet",
  );
  const [t7row] = await k.sql`select body, deleted_at, deleted_by from comments
    where id = ${ids.t7}`;
  k.ok(
    t7row?.deleted_at !== null &&
      t7row?.deleted_by === "admin" &&
      t7row?.body === "",
    "one with a reply is kept as a stub, deleted by an admin",
  );
  const t7 = art(page, ids.t7);
  k.ok(
    (await t7.getAttribute("data-moderation")) === "deleted" &&
      (await t7.locator("text=Deleted by an admin.").isVisible()),
    "and reads “Deleted by an admin.”",
  );
  await page
    .waitForFunction(
      (id) => document.activeElement?.id === `comment-${id}`,
      ids.t7,
      {
        timeout: 3000,
      },
    )
    .catch(() => {});
  k.ok(
    (await page.evaluate(() => document.activeElement?.id)) ===
      `comment-${ids.t7}`,
    "focus lands on the stub it left",
  );
  await k.shot(page, "admin-phone-deleted");
  await ctx.close();
}
