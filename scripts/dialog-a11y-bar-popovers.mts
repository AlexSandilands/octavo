// The editor's block-bar boxes (Alt, #379; Ask, #311) under the non-modal half
// of the dialog contract, for dev-dialog-a11y-gate.mts: a named role=dialog
// that is not aria-modal and leaves the page behind live, focus lands in its
// field, Tab stays inside and cycles, Escape closes it with focus back on its
// button and the block still selected, a press elsewhere closes it, and only
// one of the two is ever open. Alt runs with or without the assistant; Ask only
// when the server offers it. Its own scratch draft, removed before it returns.
import type { Page } from "playwright";
import type postgres from "postgres";
import { makeBlock } from "../src/lib/blocks";

type Deps = {
  page: Page;
  sql: postgres.Sql;
  base: string;
  heading: (name: string) => void;
  ok: (cond: unknown, msg: string) => void;
};

const ALT = '[role="dialog"][aria-label="Alt text for this photo"]';
const ASK = '[role="dialog"][aria-label="Ask the assistant about this block"]';

export async function checkBarPopovers(d: Deps) {
  const { page, sql, ok } = d;
  const photo = {
    ...makeBlock("image"),
    imageId: crypto.randomUUID(),
    alt: "",
  };
  const other = {
    ...makeBlock("image"),
    imageId: crypto.randomUUID(),
    alt: "x",
  };
  const content = {
    pages: [
      { id: crypto.randomUUID(), cover: true, blocks: [makeBlock("heading")] },
      { id: crypto.randomUUID(), blocks: [photo, other] },
    ],
  };
  const id = crypto.randomUUID();
  await sql`insert into issues (id, title, theme, status, content, footer_mark_size, footer_text_size)
            values (${id}, ${"Scratch 130 bar boxes"}, 'classic', 'draft', ${sql.json(content as never)}, 36, 12)`;
  try {
    d.heading("Block bar boxes — Alt and Ask (non-modal)");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${d.base}/admin/issues/${id}/edit`);
    await page.waitForSelector("[data-editor-block]");
    await page.click('button[aria-label="Page 2"]');
    const block = (b: { id: string }) => `[data-block-id="${b.id}"]`;
    const select = async (b: { id: string }) => {
      await page.click(block(b), { force: true, position: { x: 4, y: 4 } });
      await page.waitForSelector(`${block(b)} [data-bar-popover="alt"]`);
    };
    const trigger = (b: { id: string }, which: "alt" | "ask") =>
      `${block(b)} [data-bar-popover="${which}"] > button`;
    const focusIs = (sel: string) =>
      page.evaluate(
        (s) => document.activeElement === document.querySelector(s),
        sel,
      );
    const inside = (sel: string) =>
      page.evaluate(
        (s) => document.querySelector(s)?.contains(document.activeElement),
        sel,
      );

    await select(photo);
    const askOffered = (await page.$(trigger(photo, "ask"))) !== null;
    console.log(`  assistant ${askOffered ? "on" : "off"}`);

    // The button says so when nothing is written.
    ok(
      (await page.innerText(trigger(photo, "alt"))) === "No alt text",
      "an empty description reads “No alt text” on the button",
    );
    ok(
      (await page.getAttribute(trigger(photo, "alt"), "aria-haspopup")) ===
        "dialog",
      "the Alt button announces a dialog",
    );

    await page.click(trigger(photo, "alt"));
    await page.waitForSelector(ALT);
    const semantics = await page.$eval(ALT, (el) => ({
      modal: el.getAttribute("aria-modal"),
      // Not the whole page: an earlier check leaves its own inert probe behind.
      dead: Boolean(
        el.closest("[inert]") ||
        document
          .querySelector("[data-editor-canvas-stage]")
          ?.closest("[inert]") ||
        document
          .querySelector('button[aria-label="Page 1 (cover)"]')
          ?.closest("[inert]"),
      ),
    }));
    ok(
      semantics.modal !== "true" && !semantics.dead,
      "the Alt box is a named non-modal dialog: the page behind it is not inert",
    );
    ok(await inside(ALT), "focus moves into the Alt box on open");
    ok(
      await focusIs(`${ALT} input`),
      "and lands on its field, named for screen readers",
    );
    ok(
      (await page.getAttribute(`${ALT} input`, "aria-label")) ===
        "Describe this photo for screen readers",
      "the field carries the description prompt as its name",
    );
    for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      ok(await inside(ALT), `${key} keeps focus inside the Alt box`);
    }

    // Typing reaches the block at once; the button follows.
    await page.focus(`${ALT} input`);
    await page.keyboard.type("A boat");
    ok(
      (await page.innerText(trigger(photo, "alt"))) === "Alt text",
      "typing flips the button to its written state",
    );
    await page.keyboard.press("Escape");
    ok((await page.$(ALT)) === null, "Escape closes the Alt box");
    ok(await focusIs(trigger(photo, "alt")), "focus is back on the Alt button");
    ok(
      (await page.$(trigger(photo, "alt"))) !== null,
      "the block stayed selected",
    );

    // A press elsewhere closes it; so does choosing another block.
    await page.click(trigger(photo, "alt"));
    await page.waitForSelector(ALT);
    await page.mouse.click(20, 500);
    ok((await page.$(ALT)) === null, "a press outside closes the Alt box");
    await select(photo);
    await page.click(trigger(photo, "alt"));
    await page.waitForSelector(ALT);
    await select(other);
    ok(
      (await page.$(ALT)) === null,
      "selecting another block closes the Alt box",
    );

    if (askOffered) {
      await select(photo);
      await page.click(trigger(photo, "alt"));
      await page.waitForSelector(ALT);
      await page.click(trigger(photo, "ask"));
      await page.waitForSelector(ASK);
      ok((await page.$(ALT)) === null, "opening Ask closes the Alt box");
      ok(await inside(ASK), "focus moves into the Ask box");
      await page.keyboard.press("Escape");
      ok(await focusIs(trigger(photo, "ask")), "Escape puts focus back on Ask");
      await page.click(trigger(photo, "ask"));
      await page.waitForSelector(ASK);
      await page.click(trigger(photo, "alt"));
      await page.waitForSelector(ALT);
      ok((await page.$(ASK)) === null, "opening Alt closes the Ask box");
    }
  } finally {
    await sql`delete from issues where id = ${id}`;
  }
}
