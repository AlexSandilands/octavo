// Members layout and interaction regression gate (#263, #266).
// Run: node --env-file=.env --import tsx scripts/dev-members-responsive-gate.mts <base-url>
// Creates only run-specific local fixtures; cleanup never touches existing members.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import { checkMemberNotesPopup } from "./check-member-notes-popup.mts";

const base = process.argv[2] ?? "http://localhost:3263";
const database = process.env.DATABASE_URL;
assert(database, "Load the local DATABASE_URL before running the gate");
for (const url of [base, database]) {
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
    "This gate only runs against a local app and database",
  );
}
const sql = postgres(database, { max: 1 });
const stamp = `responsive-${randomUUID().slice(0, 8)}`;
const adminId = randomUUID();
const token = randomUUID();
const fixtures = Array.from({ length: 28 }, (_, i) => ({
  id: randomUUID(),
  email: `${stamp}-${String(i).padStart(2, "0")}-${"long".repeat(8)}@example.test`,
  name:
    i === 0
      ? "Alexandra Montgomery-Wellington with a long family name"
      : `Member ${i}`,
  notes:
    i === 0
      ? `Club secretary in Wellington. ${"Coordinates member events and magazine deliveries. ".repeat(12)}\n${"unbroken".repeat(24)}`
      : i === 1
        ? "Short note"
        : null,
}));
const first = fixtures[0]!;
const ids = [adminId, ...fixtures.map((member) => member.id)];
const output = ".data/responsive-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
// tsx preserves nested function names with this helper in evaluate callbacks.
await context.addInitScript("window.__name = (fn) => fn");
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));

async function settled() {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main")!;
    const header = document.querySelector<HTMLElement>(
      "[data-members-header]",
    )!;
    const rows = [...document.querySelectorAll<HTMLElement>(".members-row")];
    const visible = (el: HTMLElement) => el.getClientRects().length > 0;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const failures: string[] = [];
    for (const el of [
      main,
      ...main.querySelectorAll<HTMLElement>(".scrollbar-soft"),
    ]) {
      if (el.scrollWidth > el.clientWidth + 1)
        failures.push(`horizontal overflow: ${el.tagName}`);
    }
    for (const row of rows) {
      const bounds = box(row);
      const cells = [
        ...row.querySelectorAll<HTMLElement>("[data-member-cell]"),
      ].filter(visible);
      for (const cell of cells) {
        const r = box(cell);
        if (r.x < bounds.x - 1 || r.right > bounds.right + 1) {
          failures.push(`cell outside row: ${cell.dataset.memberCell}`);
        }
      }
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i]!,
            b = cells[j]!;
          if (a.contains(b) || b.contains(a)) continue;
          const ar = box(a),
            br = box(b);
          if (
            Math.min(ar.right, br.right) - Math.max(ar.x, br.x) > 1 &&
            Math.min(ar.bottom, br.bottom) - Math.max(ar.y, br.y) > 1
          ) {
            failures.push(
              `overlapping cells: ${a.dataset.memberCell}/${b.dataset.memberCell}`,
            );
          }
        }
      }
      for (const control of row.querySelectorAll<HTMLElement>(
        "button,input[type=checkbox]",
      )) {
        if (!visible(control)) continue;
        const r = box(control);
        if (r.x < bounds.x - 1 || r.right > bounds.right + 1)
          failures.push("control outside row");
        if (r.width < 43 || r.height < 43)
          failures.push(
            `small target: ${control.getAttribute("aria-label") ?? control.textContent}`,
          );
      }
      if (visible(header)) {
        for (const label of header.querySelectorAll<HTMLElement>(
          "[data-member-cell]",
        )) {
          const cell = row.querySelector<HTMLElement>(
            `[data-member-cell="${label.dataset.memberCell}"]`,
          );
          if (cell && Math.abs(box(label).x - box(cell).x) > 1)
            failures.push(`heading misaligned: ${label.dataset.memberCell}`);
        }
      }
    }
    return {
      failures: [...new Set(failures)],
      table: visible(header),
      rows: rows.length,
    };
  });
}

async function checkLayout(label: string, screenshot = false) {
  await settled();
  const result = await geometry(page);
  assert.equal(result.rows, 25);
  assert.deepEqual(
    result.failures,
    [],
    `${label}: ${result.failures.join(", ")}`,
  );
  if (screenshot)
    await page.screenshot({ path: `${output}/after-${label}.png` });
  console.log(
    `ok — ${label}: ${result.table ? "table" : "compact"}, aligned with no overflow`,
  );
  return result.table;
}

try {
  await sql`insert into users (id,email,name,is_admin,subscribed)
    values (${adminId},${`${stamp}-admin@example.test`},'Layout gate admin',true,true)`;
  await sql`insert into sessions (session_token,user_id,expires)
    values (${token},${adminId},now() + interval '1 day')`;
  for (const [i, member] of fixtures.entries()) {
    await sql`insert into users (id,email,name,notes,subscribed,created_at)
      values (${member.id},${member.email},${member.name},${member.notes},false,
      now() + interval '1 hour' - ${i} * interval '1 second')`;
  }
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  // Excludes the gate admin while serving two pages of scratch members.
  await page.goto(`${base}/admin/members?q=${stamp}-&filter=unsubscribed`);
  await page.locator(".members-row").first().waitFor();
  for (const width of [
    320, 360, 390, 639, 640, 767, 768, 820, 1023, 1024, 1100, 1279, 1280, 1366,
    1440, 1920,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(
      String(width),
      [320, 390, 820, 1024, 1440].includes(width),
    );
  }
  // Sweep through the actual table/compact transition, including fractional fits.
  for (let width = 1300; width <= 1380; width += 4) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(`transition-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  assert(await checkLayout("wide"));
  // The same viewport with a narrower content pane must use compact rows.
  await page.locator("main").evaluate((el) => {
    el.style.maxWidth = "800px";
  });
  assert.equal(await checkLayout("narrow-container"), false);
  await page.locator("main").evaluate((el) => {
    el.style.maxWidth = "";
  });

  const pinned = await page
    .locator("[data-members-header]")
    .evaluate((header) => {
      const pane = header.closest(".scrollbar-soft")!;
      pane.scrollTop = 200;
      return Math.abs(
        header.getBoundingClientRect().top - pane.getBoundingClientRect().top,
      );
    });
  assert(pinned < 1, "Column headings stay pinned when rows scroll");
  await page.locator("[data-members-header]").evaluate((header) => {
    header.closest(".scrollbar-soft")!.scrollTop = 0;
  });

  await page.locator("html").evaluate((el) => {
    el.style.zoom = "2";
  });
  await checkLayout("200-percent-scale", true);
  await page.locator("html").evaluate((el) => {
    el.style.zoom = "";
  });
  // Effective viewport of a 1440×900 browser at 200% zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  await checkLayout("zoom-viewport", true);
  await page.setViewportSize({ width: 1440, height: 900 });

  const row = page.locator(".members-row").filter({
    has: page.getByRole("checkbox", {
      name: `Select ${first.name}`,
      exact: true,
    }),
  });
  const selection = row.getByRole("checkbox");
  await selection.focus();
  await page.keyboard.press("Space");
  assert(await selection.isChecked(), "Keyboard selects the member");
  for (const width of [1024, 390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkLayout(`selected-${width}`, width === 390);
    assert(
      await selection.isChecked(),
      "Selection survives responsive transitions",
    );
    assert(
      await selection.evaluate((el) => el === document.activeElement),
      "Focus survives responsive transitions",
    );
  }

  await checkMemberNotesPopup(page, row, output);

  await row
    .getByRole("button", { name: `Edit ${first.name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Notes (optional)").fill("Updated layout gate note");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() =>
    document
      .querySelector('.members-row [data-member-cell="notes"]')
      ?.textContent?.includes("Updated layout gate note"),
  );
  assert(await selection.isChecked(), "Editing preserves selection");

  await row
    .getByRole("button", { name: `Make admin ${first.name}`, exact: true })
    .click();
  await row
    .getByRole("button", {
      name: `Remove admin from ${first.name}`,
      exact: true,
    })
    .waitFor();
  await row
    .getByRole("button", { name: `Remove ${first.name}`, exact: true })
    .click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(
    await row
      .getByRole("button", { name: `Remove ${first.name}`, exact: true })
      .evaluate((el) => el === document.activeElement),
  );

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(/page=2/);
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert(
    await page.getByText("1 selected", { exact: true }).isVisible(),
    "Selection persists across pages",
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByText("Page 1 of 2", { exact: true }).waitFor();
  assert(await selection.isChecked());

  const search = page.getByRole("textbox", { name: /Search all members/ });
  await search.fill(first.email);
  await page.waitForFunction(
    () => document.querySelectorAll(".members-row").length === 1,
  );
  assert(await selection.isChecked(), "Selection persists through search");
  await search.fill(`${stamp}-`);
  await page.waitForFunction(
    () => document.querySelectorAll(".members-row").length === 25,
  );
  await page
    .getByRole("button", { name: "Select all 28 matching", exact: true })
    .click();
  await page.getByText("28 selected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await selection.check();

  // Bulk subscribe removes the selected member from the active unsubscribed filter.
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await row.waitFor({ state: "detached" });
  const [saved] =
    await sql`select subscribed, is_admin, notes from users where id=${first.id}`;
  assert.equal(saved?.subscribed, true);
  assert.equal(saved?.is_admin, true);
  assert.equal(saved?.notes, "Updated layout gate note");
  assert.deepEqual(errors, [], "No browser errors");
  console.log(
    "ok — notes, editing, role, removal confirmation, paging, selection and bulk action",
  );
} finally {
  await browser.close();
  await sql`delete from users where id in ${sql(ids)}`;
  await sql.end();
}
