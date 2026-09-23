// The settings and members half of dev-reports-gate.mts (issue #302): the
// discussion switch and the removed-member choice on /admin/magazine, then both
// removal confirmations and what confirming them does. Split out for length;
// it runs inside that gate, on its session and fixtures.
import { writeFileSync } from "node:fs";
import type { Page } from "playwright";
import type postgres from "postgres";
import { expandMember } from "./check-member-disclosure.mts";
import type { reportsFixtures } from "./fixtures/reports-fixtures.mts";

type Ctx = {
  page: Page;
  sql: postgres.Sql;
  f: ReturnType<typeof reportsFixtures>;
  base: string;
  shots: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
  until: (check: () => Promise<unknown>) => Promise<void>;
  getObject: (key: string) => Promise<Buffer | null>;
  alice: { id: string; email: string; name: string };
  issueId: string;
  longComment: string;
};

export async function checkSettingsAndRemoval(ctx: Ctx) {
  const { page, sql, f, base, shots, ok, heading, until, getObject } = ctx;
  const { alice, issueId } = ctx;
  heading("settings on /admin/magazine");
  await page.goto(`${base}/admin/magazine`);
  const discuss = page.getByRole("checkbox", {
    name: /Let members discuss each issue/,
  });
  ok(
    await discuss.isChecked(),
    "the Discussion switch reflects the stored value (on)",
  );
  const save = page.getByRole("button", { name: "Save changes" });
  const stored = async () =>
    (
      await sql`select comments_enabled, removed_member_comments from settings`
    )[0]!;
  await discuss.uncheck();
  await save.click();
  await page.waitForSelector("text=Saved — live on the site now.");
  ok(
    (await stored()).comments_enabled === false,
    "switching it off saves false",
  );
  await discuss.check();
  await page.getByRole("radio", { name: /Delete their comments/ }).check();
  await save.click();
  await page.waitForSelector("text=Saved — live on the site now.");
  ok(
    (await stored()).comments_enabled === true &&
      (await stored()).removed_member_comments === "delete",
    "switching it back on and choosing Delete saves both",
  );
  const keep = page.getByRole("radio", {
    name: /Keep their comments as “Former member”/,
  });
  await page.getByRole("radio", { name: /Delete their comments/ }).focus();
  await page.keyboard.press("ArrowUp");
  ok(
    await keep.isChecked(),
    "the removal choice is a radio group the arrow keys move through",
  );
  await page.locator("#comments-enabled-hint").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/settings-discussion.png` });
  writeFileSync(
    `${shots}/settings-aria.yml`,
    await page.locator("fieldset").ariaSnapshot(),
  );

  heading("members: single removal under anonymise");
  await sql`update settings set removed_member_comments = 'anonymise'`;
  const aliceAvatar2 = await f.avatar();
  await f.name(alice.id, "Alice Second", aliceAvatar2.id);
  await page.goto(`${base}/admin/members?q=${encodeURIComponent(alice.email)}`);
  const aliceRow = page
    .locator(".members-row")
    .filter({ hasText: alice.email });
  await expandMember(aliceRow);
  const aliceLive = Number(
    (
      await sql`select count(*)::int as n from comments where author_id = ${alice.id} and deleted_at is null`
    )[0]!.n,
  );
  await aliceRow.getByRole("button", { name: `Remove ${alice.name}` }).click();
  const note = page.locator("[role=dialog] [data-removal-comments]");
  await page.waitForFunction(
    () =>
      !document
        .querySelector("[data-removal-comments]")
        ?.textContent?.includes("Checking"),
  );
  ok(
    (await note.innerText()).includes(
      `Their ${aliceLive} comments will stay, shown as “Former member”`,
    ),
    `the confirmation counts their comments and says they stay (“${(await note.innerText()).trim()}”)`,
  );
  await page.screenshot({ path: `${shots}/members-remove-one.png` });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove member" })
    .click();
  await until(
    async () =>
      (await sql`select id from users where id = ${alice.id}`).length === 0,
  );
  const kept =
    await sql`select author_id, author_name_id from comments where id = ${ctx.longComment}`;
  ok(
    kept.length === 1 &&
      kept[0]!.author_id === null &&
      kept[0]!.author_name_id === null,
    "confirmed: their comments stay, unattributed (“Former member”)",
  );
  ok(
    (await getObject(aliceAvatar2.key)) === null,
    "…and their avatar object is gone from storage",
  );

  heading("members: bulk removal under delete");
  const m = [
    await f.user(`${f.stamp} Bulk One`),
    await f.user(`${f.stamp} Bulk Two`),
  ];
  const mAvatar = await f.avatar();
  const mName = await f.name(m[0]!.id, "Bulk One", mAvatar.id);
  const mName2 = await f.name(m[1]!.id, "Bulk Two");
  const bulkComments = [
    await f.comment(issueId, m[0]!, mName, "bulk a"),
    await f.comment(issueId, m[0]!, mName, "bulk b"),
    await f.comment(issueId, m[1]!, mName2, "bulk c"),
  ];
  await sql`update settings set removed_member_comments = 'delete'`;
  await page.goto(
    `${base}/admin/members?q=${encodeURIComponent(`${f.stamp} Bulk`)}`,
  );
  await page.getByRole("checkbox", { name: /^Select all 2 members/ }).check();
  await page.getByRole("button", { name: "Remove selected" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("[data-removal-comments]")
        ?.textContent?.includes("Checking"),
  );
  ok(
    (await note.innerText()).includes("Their 3 comments will be deleted"),
    `the bulk confirmation totals them and says they go (“${(await note.innerText()).trim()}”)`,
  );
  await page.screenshot({ path: `${shots}/members-remove-bulk.png` });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove 2" })
    .click();
  await page.waitForSelector("text=2 members removed");
  ok(
    (await sql`select id from comments where id in ${sql(bulkComments)}`)
      .length === 0,
    "confirmed: their comments are deleted",
  );
  ok(
    (await getObject(mAvatar.key)) === null,
    "…and the avatar object is gone from storage",
  );
}
