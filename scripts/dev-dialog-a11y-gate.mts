// Dev-only: proves the shared dialog shell's accessibility contract (issue
// #130) headless against a running dev server, on every dialog it now backs.
//
// The bug: each dialog was a bare <div> — no role/aria-modal/accessible name,
// Escape did nothing, Tab walked out into the page behind, and closing dropped
// focus on <body>. For each dialog this checks, in order:
//   a. role=dialog + aria-modal=true, and aria-labelledby resolving to the
//      visible heading's own text; initial focus inside the panel,
//   b. Tab cycles inside and never reaches the page behind; Shift+Tab from the
//      first control wraps to the last,
//   c. Escape closes — and is refused while a save is in flight,
//   d. every close path (Escape, Cancel, ×, a successful save) puts focus back
//      on the button that opened it,
//   e. the in-flight locks (#141's disabled ×, the disabled Cancel) still hold.
//
// It mints its own scratch admin + session + draft issue and removes them again
// in the finally block — it never seeds and never touches existing rows.
// Run: npx tsx scripts/dev-dialog-a11y-gate.mts <base-url>
import postgres from "postgres";
import { chromium, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-dialog-a11y-gate.mts <base-url>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const sql = postgres(process.env.DATABASE_URL!);

const userId = crypto.randomUUID();
// A second scratch member, because the signed-in admin's own row refuses to be
// removed (the no-self-removal guard) and the confirm dialog hangs off Remove.
const otherId = crypto.randomUUID();
const issueId = crypto.randomUUID();
const token = crypto.randomUUID();
const email = `scratch-130-${userId.slice(0, 8)}@example.invalid`;
const otherEmail = `scratch-130-other-${otherId.slice(0, 8)}@example.invalid`;
const otherName = "Scratch Confirm Target";
const issueNumber = 91300 + Math.floor(Math.random() * 500);

// ── Probes ──────────────────────────────────────────────────────────────────

/** The open dialog's semantics, read the way an assistive technology would. */
const semantics = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog]");
    if (!panel) return null;
    const labelledBy = panel.getAttribute("aria-labelledby");
    const label = labelledBy ? document.getElementById(labelledBy) : null;
    const active = document.activeElement as HTMLElement | null;
    return {
      role: panel.getAttribute("role"),
      modal: panel.getAttribute("aria-modal"),
      labelledBy,
      // The resolved accessible name — the words actually on screen.
      name: label?.textContent?.trim() ?? null,
      labelIsHeading: label?.tagName.toLowerCase() ?? null,
      focusInside: active != null && panel.contains(active),
      focusDescription: describe(active),
    };

    function describe(el: HTMLElement | null) {
      if (!el || el === document.body) return "<body>";
      const name =
        el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        name ? `[${name}]` : ""
      }`;
    }
  });

const dialogOpen = (page: Page) => page.isVisible("[role=dialog]");

/** Where focus is, described for an assertion message. */
const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "<body>";
    const name = el.getAttribute("aria-label") ?? el.textContent?.trim();
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
      name ? `[${name.slice(0, 30)}]` : ""
    }`;
  });

/**
 * Where a block sits on screen, as a stable string. The editor canvas pans and
 * scrolls, and either moves the block — so comparing this across an interaction
 * says whether the canvas stayed put.
 */
const blockPosition = (page: Page, blockId: string) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return `${Math.round(r.left)},${Math.round(r.top)}`;
  }, blockId);

const focusInsideDialog = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector("[role=dialog]");
    return panel != null && panel.contains(document.activeElement);
  });

/**
 * Tab all the way round and back. Returns the ordered focus stops and whether
 * focus ever escaped the panel — the point of the trap. Walks one more step
 * than there are focusable controls, so a trap that fails to wrap shows up as
 * an escape rather than as a short list.
 */
async function tabCycle(page: Page, steps: number) {
  const stops: string[] = [];
  let escaped = false;
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    stops.push(await active(page));
    if (!(await focusInsideDialog(page))) escaped = true;
  }
  return { stops, escaped };
}

/** Count of controls the trap will cycle through, from the live DOM. */
const focusableCount = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog]");
    if (!panel) return 0;
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.getClientRects().length > 0).length;
  });

// ── The shared checks, run against whatever dialog is open ──────────────────

/**
 * a + b: semantics, initial focus, and the trap. `expectedName` is the visible
 * heading text the accessible name must resolve to.
 */
async function checkOpenDialog(page: Page, expectedName: string) {
  const s = await semantics(page);
  ok(s != null, "an element with role=dialog is in the DOM");
  ok(s!.role === "dialog", `role is dialog (got ${s!.role})`);
  ok(s!.modal === "true", `aria-modal is true (got ${s!.modal})`);
  ok(
    s!.labelledBy != null,
    `aria-labelledby is set (got ${s!.labelledBy ?? "nothing"})`,
  );
  ok(
    s!.name === expectedName,
    `the accessible name resolves to the visible heading "${expectedName}" (got "${s!.name}")`,
  );
  ok(
    s!.labelIsHeading === "h2",
    `the label element is the heading itself (got <${s!.labelIsHeading}>)`,
  );
  ok(
    s!.focusInside,
    `initial focus is inside the dialog (${s!.focusDescription})`,
  );

  // b: a full lap plus one step. Nothing may land outside the panel.
  const n = await focusableCount(page);
  ok(n > 0, `the dialog has ${n} focusable controls`);
  const forward = await tabCycle(page, n + 1);
  ok(
    !forward.escaped,
    `Tab never reaches the page behind — ${n + 1} presses, stops: ${forward.stops.join(" → ")}`,
  );

  // Shift+Tab at the first control wraps to the last.
  const first = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
    const els = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.getClientRects().length > 0);
    els[0]!.focus();
    return {
      first: els[0]!.getAttribute("aria-label") ?? els[0]!.textContent?.trim(),
      last:
        els[els.length - 1]!.getAttribute("aria-label") ??
        els[els.length - 1]!.textContent?.trim(),
    };
  });
  await page.keyboard.press("Shift+Tab");
  const wrapped = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
    const els = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.getClientRects().length > 0);
    return document.activeElement === els[els.length - 1];
  });
  ok(
    wrapped,
    `Shift+Tab on the first control wrapped to the last ("${first.last}") — landed on ${await active(page)}`,
  );
}

// `active()` abbreviates long names, so compare on the same prefix it keeps —
// a member's row buttons are named after their whole email address.
const isTrigger = (landed: string, triggerLabel: string) =>
  landed.includes(triggerLabel.slice(0, 30));

/** c + d: Escape closes, and focus returns to the trigger that opened it. */
async function checkEscapeRestores(page: Page, triggerLabel: string) {
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(!(await dialogOpen(page)), "Escape closes the dialog");
  const landed = await active(page);
  ok(
    isTrigger(landed, triggerLabel),
    `Escape returned focus to the trigger ("${triggerLabel}") — landed on ${landed}`,
  );
}

/**
 * c + d by the other exit: a press on the backdrop closes the dialog and puts
 * focus back on the trigger. The corner is used deliberately — it is backdrop
 * on every panel size, and it is where a stray click actually lands.
 */
async function checkBackdropRestores(page: Page, triggerLabel: string) {
  await page.mouse.click(8, 8);
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(!(await dialogOpen(page)), "a press on the backdrop closes the dialog");
  const landed = await active(page);
  ok(
    isTrigger(landed, triggerLabel),
    `the backdrop close returned focus to the trigger ("${triggerLabel}") — landed on ${landed}`,
  );
}

/** Re-open a dialog and leave it open, for a second exit to be tested. */
async function reopen(page: Page, triggerSelector: string) {
  await page.click(triggerSelector);
  await page.waitForSelector("[role=dialog]");
}

const browser = await chromium.launch();
try {
  // ── Scratch fixtures ──────────────────────────────────────────────────────
  // The montage dialog needs a montage block, so the scratch draft copies the
  // content document of whichever issue has one (the seed authors exactly one,
  // but which issue that is depends on the database this runs against).
  const issues = await sql<
    { content: { pages: { blocks: { id: string; type: string }[] }[] } }[]
  >`select content from issues order by number`;
  const withMontage = issues.find((i) =>
    i.content.pages.some((p) => p.blocks.some((b) => b.type === "montage")),
  );
  if (!withMontage) throw new Error("no issue holds a montage block to copy");
  const content = withMontage.content;
  // The editor renders one page at a time, so the gate needs the montage's page
  // as well as its block id.
  const montagePage = content.pages.findIndex((p) =>
    p.blocks.some((b) => b.type === "montage"),
  );
  const montageBlockId = content.pages[montagePage]!.blocks.find(
    (b) => b.type === "montage",
  )!.id;

  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${email}, true, false, now())`;
  await sql`insert into users (id, email, name, is_admin, subscribed, email_verified)
            values (${otherId}, ${otherEmail}, ${otherName}, false, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  await sql`insert into issues (id, number, title, theme, status, content)
            values (${issueId}, ${issueNumber}, ${"Scratch 130"}, 'classic',
                    'draft', ${sql.json(content)})`;
  console.log(`scratch issue ${issueId} (no. ${issueNumber}), user ${email}`);

  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await ctx.newPage();

  // ── 1. MemberDialog (add) ─────────────────────────────────────────────────
  heading("MemberDialog — add");
  await page.goto(`${base}/admin/members`);
  await page.waitForSelector("button:has-text('Add member')");
  await page.click("button:has-text('Add member')");
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Add a member");
  await checkEscapeRestores(page, "Add member");

  await reopen(page, "button:has-text('Add member')");
  await checkBackdropRestores(page, "Add member");

  // Cancel restores focus too.
  await reopen(page, "button:has-text('Add member')");
  await page.click("[role=dialog] button:has-text('Cancel')");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(
    (await active(page)).includes("Add member"),
    `Cancel restores focus to the trigger (landed on ${await active(page)})`,
  );

  // ── 2. MemberDialog (edit) — the successful-save close path ───────────────
  heading("MemberDialog — edit (save path)");
  // The scratch admin is its own row; search narrows the list to just it.
  await page.goto(`${base}/admin/members?q=scratch-130`);
  await page.waitForSelector(`text=${email}`);
  const editLabel = `Edit ${email}`;
  await page.click(`button[aria-label="${editLabel}"]`);
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Edit member");

  // A successful save closes the dialog; focus must land back on the pencil.
  await checkBackdropRestores(page, editLabel);

  await reopen(page, `button[aria-label="${editLabel}"]`);
  await page.fill("#member-name", "Scratch One Thirty");
  await page.click("[role=dialog] button:has-text('Save changes')");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(true, "a successful save closed the dialog");
  // The row's own pencil — the same DOM element, relabelled by the save, which
  // is why this matches on the trigger's identity rather than its old words.
  const afterSave = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") ?? "<none>",
  );
  ok(
    afterSave.startsWith("Edit "),
    `a successful save restores focus to the row's edit trigger (landed on aria-label "${afterSave}")`,
  );

  // ── 3. ImportDialog ───────────────────────────────────────────────────────
  heading("ImportDialog");
  await page.goto(`${base}/admin/members`);
  await page.waitForSelector("button:has-text('Import CSV')");
  await page.click("button:has-text('Import CSV')");
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Import from CSV");
  ok(
    await page.isVisible("[role=dialog] button:has-text('Choose CSV file')"),
    "the rebuilt import flow (#144) still renders its file chooser",
  );
  await checkEscapeRestores(page, "Import CSV");

  await reopen(page, "button:has-text('Import CSV')");
  await checkBackdropRestores(page, "Import CSV");

  // ── 4. ConfirmDialog ──────────────────────────────────────────────────────
  heading("ConfirmDialog");
  await page.goto(`${base}/admin/members?q=scratch-130-other`);
  await page.waitForSelector(`text=${otherEmail}`);
  const removeLabel = `Remove ${otherName}`;
  await page.click(`button[aria-label="${removeLabel}"]`);
  await page.waitForSelector("[role=dialog]");
  // Asserted before the Tab lap below moves focus off it.
  ok(
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement | null)?.textContent?.trim() ===
        "Cancel",
    ),
    "initial focus is the safe Cancel button, never Confirm",
  );
  await checkOpenDialog(page, `Remove ${otherName}?`);
  await checkBackdropRestores(page, removeLabel);
  // And Escape, which it never had.
  await reopen(page, `button[aria-label="${removeLabel}"]`);
  await checkEscapeRestores(page, removeLabel);

  // ── 5. SponsorDialog — including the in-flight save lock ─────────────────
  heading("SponsorDialog");
  await page.goto(`${base}/admin/sponsors`);
  await page.waitForSelector("button:has-text('Add sponsor')");
  await page.click("button:has-text('Add sponsor')");
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Add sponsor");
  await checkEscapeRestores(page, "Add sponsor");

  await reopen(page, "button:has-text('Add sponsor')");
  await checkBackdropRestores(page, "Add sponsor");

  // (c)+(e) the lock: hold the save server-side, then prove Escape, the backdrop
  // press, Cancel and the × are all refused while it is in flight.
  await reopen(page, "button:has-text('Add sponsor')");
  await page.fill("#sponsor-name", "Scratch 130 Sponsor");
  // Stall the server action so `saving` stays true for the assertions below.
  // A one-shot flag rather than an unroute(): tearing the handler down while
  // its own request is still parked in the sleep aborts it.
  let stallSave = true;
  await page.route("**/admin/sponsors", async (route) => {
    if (route.request().method() === "POST" && stallSave) {
      stallSave = false;
      await new Promise((r) => setTimeout(r, 4000));
    }
    return route.continue();
  });
  await page.click("[role=dialog] button:has-text('Save sponsor')");
  await page.waitForSelector("[role=dialog] button:has-text('Saving…')");
  ok(true, "the save is in flight (the button reads Saving…)");
  ok(
    await page.isDisabled('[role=dialog] button[aria-label="Close"]'),
    "the close × is disabled while saving (#141 unregressed)",
  );
  ok(
    await page.isDisabled("[role=dialog] button:has-text('Cancel')"),
    "Cancel is disabled while saving",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok(
    await dialogOpen(page),
    "Escape does NOT close the dialog while the save is in flight",
  );
  // Park focus somewhere real first: pressing Save disables it (`busy`), and a
  // control that disables under the user's hands drops focus to <body> — the
  // #131 class of bug, pre-existing here and not what this assertion is about.
  await page.focus("#sponsor-name");
  await page.mouse.click(8, 8);
  await page.waitForTimeout(300);
  ok(
    await dialogOpen(page),
    "a backdrop press does NOT close the dialog while the save is in flight",
  );
  ok(
    await focusInsideDialog(page),
    `the refused backdrop press left focus where it was rather than blurring it to <body> (${await active(page)})`,
  );
  await page.waitForSelector("[role=dialog]", {
    state: "detached",
    timeout: 20_000,
  });
  ok(true, "the dialog closed once the save completed");
  ok(
    (await active(page)).includes("Add sponsor"),
    `the save-path close restores focus to the trigger (landed on ${await active(page)})`,
  );

  // Clean the sponsor up through its own confirm dialog — which also proves the
  // shell works on the second confirm site.
  await page.waitForSelector("text=Scratch 130 Sponsor");
  await page.click('button[aria-label="Delete Scratch 130 Sponsor"]');
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Delete “Scratch 130 Sponsor”?");
  await page.click("[role=dialog] button:has-text('Delete sponsor')");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(true, "the sponsor confirm dialog deleted the scratch sponsor");

  // ── 6. LogoDialog ─────────────────────────────────────────────────────────
  heading("LogoDialog");
  await page.goto(`${base}/admin/magazine`);
  await page.waitForSelector("button:has-text('Add logo')");
  await page.click("button:has-text('Add logo')");
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Add logo");
  await checkBackdropRestores(page, "Add logo");

  // The × closes it, and focus comes back.
  await reopen(page, "button:has-text('Add logo')");
  await page.click('[role=dialog] button[aria-label="Close"]');
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(
    (await active(page)).includes("Add logo"),
    `the × restores focus to the trigger (landed on ${await active(page)})`,
  );

  // ── 7. MontageDialog (editor) ────────────────────────────────────────────
  heading("MontageDialog");
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector("button:has-text('Theme:')");
  // The editor shows one page at a time and the block toolbar only appears for
  // the selected block, so walk the rail to the montage's page, then select it.
  // The rail's thumbnails are unlabelled (they are pictures of the page), so
  // they are reached through the delete button that names the page beside them.
  await page.evaluate((n) => {
    const del = document.querySelector(`[aria-label="Delete page ${n}"]`);
    del?.closest("div.group")?.querySelector("button")?.click();
  }, montagePage + 1);
  await page.click(`[data-block-id="${montageBlockId}"]`, { timeout: 20_000 });
  // The control names itself after the slide count, so match either wording.
  const montageTrigger = page.locator("button", {
    hasText: /^(Add images|Edit montage \()/,
  });
  await montageTrigger.waitFor({ timeout: 15_000 });
  const montageLabel = (await montageTrigger.textContent())!.trim();
  await montageTrigger.click();
  await page.waitForSelector("[role=dialog]");
  await checkOpenDialog(page, "Montage");
  // The MenuSelect inside still owns Escape: the first press closes the menu,
  // not the dialog.
  await page.click("[role=dialog] button:has-text('Change image every:')");
  await page.waitForSelector('[role=menu][aria-label="Change image every"]');
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(
    !(await page.isVisible('[role=menu][aria-label="Change image every"]')),
    "Escape closed the open menu",
  );
  ok(
    await dialogOpen(page),
    "…and left the dialog open — an open menu still owns Escape",
  );
  await checkEscapeRestores(page, montageLabel);

  // The backdrop press closes it too — and, because this dialog floats over the
  // editor canvas, the closing press must not also reach what is behind it. The
  // canvas deselects the current block on a stray click and pans on a drag, so
  // the block staying selected (its toolbar is still on screen) and the canvas
  // not having moved are the two things to hold.
  await reopen(page, `button:has-text("${montageLabel}")`);
  const before = await blockPosition(page, montageBlockId);
  await checkBackdropRestores(page, montageLabel);
  ok(
    await montageTrigger.isVisible(),
    "the closing press left the montage block selected — the editor behind it never saw the click",
  );
  const after = await blockPosition(page, montageBlockId);
  ok(
    before !== null && after === before,
    `the canvas did not pan or scroll (${before} → ${after})`,
  );

  await ctx.close();
  console.log("\nPASS — every converted dialog meets the #130 contract");
} finally {
  await browser.close();
  // By pattern, not just by id: a run that dies mid-way still has to leave the
  // shared dev database exactly as it found it.
  await sql`delete from sponsors where name = ${"Scratch 130 Sponsor"}`;
  await sql`delete from issues where id = ${issueId} or title = ${"Scratch 130"}`;
  await sql`delete from sessions where session_token = ${token}
              or user_id in (select id from users
                             where email like ${"scratch-130%"})`;
  await sql`delete from users where id in (${userId}, ${otherId})
              or email like ${"scratch-130%"}`;
  console.log("scratch rows removed");
  await sql.end();
}
