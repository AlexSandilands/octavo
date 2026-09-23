// The admin half of dev-profile-gate.mts (issue #300): posting names on the
// members list and the posting-names dialog's rename / clear photo / retire,
// plus the refusal a non-admin gets from the same actions.
import { expandMember } from "./check-member-disclosure.mts";
import type { ProfileKit } from "./profile-gate-kit.mts";

export async function membersGate(kit: ProfileKit) {
  const { browser, base, sql, ok, heading } = kit;
  heading("admin — members list and the posting-names dialog");
  const admin = await kit.member("dialog-admin", { admin: true });
  const subject = await kit.member("subject", { name: "Subject Person" });
  const one = await kit.nameRow(subject.id, "Subj One");
  const two = await kit.nameRow(subject.id, "Subj Two");
  const three = await kit.nameRow(subject.id, "Subj Three");
  await kit.upload(subject, one, kit.smallJpeg);
  const [photo] = await sql<{ id: string }[]>`
    select avatar_image_id as id from member_names where id = ${one}`;

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: admin.token, url: base },
  ]);
  const page = await ctx.newPage();
  await page.goto(
    `${base}/admin/members?q=${encodeURIComponent(subject.email)}`,
  );
  const row = page.locator(".members-row").filter({ hasText: subject.email });
  await row.waitFor();
  ok(
    (await row.locator("[data-member-posting-names]").textContent()) ===
      "Posts as Subj One, Subj Two, Subj Three",
    "the row lists the member's posting names",
  );
  await expandMember(row);
  const trigger = row.getByRole("button", {
    name: "Posting names for Subject Person",
  });
  await trigger.click();
  await page.waitForSelector("[role=dialog] h2:has-text('Posting names')");
  await page.screenshot({ path: `${kit.out}/admin-dialog.png` });

  const dialog = page.locator("[role=dialog]");
  const status = dialog.locator("[role=status]");
  const said = (text: string) =>
    page
      .waitForFunction(
        ([want]) =>
          document
            .querySelector("[role=dialog] [role=status]")
            ?.textContent?.includes(want!) ?? false,
        [text],
        { timeout: 10_000 },
      )
      .then(() => true)
      .catch(() => false);

  await dialog.getByRole("button", { name: "Rename Subj Two" }).click();
  // A real name the member-facing filter refuses: the admin can set it.
  await page.fill(`#admin-rename-${two}`, "Dick Turner");
  await page.keyboard.press("Enter");
  ok(await said("to “Dick Turner”"), "the admin rename saves and is announced");
  const [renamed] = await sql`select name from member_names where id = ${two}`;
  ok(
    renamed?.name === "Dick Turner",
    "a name the filter refuses is set by the admin",
  );

  await dialog
    .getByRole("button", { name: "Clear photo from Subj One" })
    .click();
  ok(await said("Cleared the photo"), "clear photo is announced");
  const [cleared] =
    await sql`select avatar_image_id from member_names where id = ${one}`;
  const [counted] = await sql<{ n: number }[]>`
    select count(*)::int as n from images where id = ${photo?.id ?? ""}`;
  const rows = counted?.n;
  ok(
    cleared?.avatar_image_id === null && rows === 0,
    "the photo and its image row are gone",
  );

  await dialog.getByRole("button", { name: "Retire Subj Three" }).click();
  ok(await said("Retired “Subj Three”"), "retire is announced");
  const [retired] =
    await sql`select retired_at from member_names where id = ${three}`;
  ok(retired?.retired_at !== null, "the name is retired");
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(
    (await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    )) === "Posting names for Subject Person",
    "closing returns focus to the row's Posting names button",
  );
  ok(
    (await row.locator("[data-member-posting-names]").textContent()) ===
      "Posts as Subj One, Dick Turner",
    "the row reflects the rename and the retirement",
  );
  await page.screenshot({ path: `${kit.out}/admin-members.png` });
  await ctx.close();

  heading("admin actions refuse a non-admin");
  const actions =
    await import("../src/app/admin/members/posting-names-actions.ts");
  kit.as(subject);
  const tries = [
    await actions.adminRenameNameAction(one, "Someone Else"),
    await actions.adminRetireNameAction(one),
    await actions.adminClearAvatarAction(one),
  ];
  ok(
    tries.every((t) => !t.ok && t.reason === "Admin access required."),
    "rename, retire and clear photo are all refused",
  );
  kit.as(null);
  void status;
}
