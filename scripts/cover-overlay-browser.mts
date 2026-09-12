import assert from "node:assert/strict";
import { resolveCoverAppearance } from "../src/lib/cover-appearance";
import { existsSync } from "node:fs";
import {
  coverOverlaySchema,
  type Page,
  type IssueContent,
} from "../src/lib/blocks";
import { setCoverBackground } from "../src/features/editor/cover-layout";
const styles = coverOverlaySchema.shape.style.options;
const positions = coverOverlaySchema.shape.position.options;

export async function browserPass(base: string, cover: Page) {
  assert(
    ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
    "local server only",
  );
  for (const env of [".env", ".env.local"])
    if (existsSync(env)) process.loadEnvFile(env);
  const { default: postgres } = await import("postgres");
  const { chromium } = await import("playwright");
  const { createHash } = await import("node:crypto");
  const sql = postgres(process.env.DATABASE_URL!);
  const id = crypto.randomUUID(),
    user = crypto.randomUUID(),
    token = crypto.randomUUID();
  const browser = await chromium.launch();
  try {
    const [image] = await sql<
      { id: string }[]
    >`select id from images where key like 'seed/%' order by key limit 1`;
    assert(image, "a local seed photo is required");
    const front: Page = {
      ...cover,
      blocks: cover.blocks.map((b) =>
        b.type === "image" ? { ...b, imageId: image.id } : b,
      ),
    };
    const content: IssueContent = {
      version: 6,
      pages: [
        front,
        {
          id: "body",
          blocks: [
            {
              id: "body-heading",
              type: "heading",
              kicker: "Inside",
              title: "Club news",
            },
          ],
        },
        {
          ...front,
          id: "back",
          cover: true,
          blocks: front.blocks.map((b) => ({ ...b, id: `back-${b.id}` })),
        },
      ],
    };
    await sql`insert into users (id, email, is_admin, subscribed, email_verified) values (${user}, ${`scratch-243-${user}@example.invalid`}, true, false, now())`;
    await sql`insert into sessions (session_token, user_id, expires) values (${token}, ${user}, now() + interval '1 hour')`;
    const [issue] = await sql<
      { number: number }[]
    >`insert into issues (id, number, title, theme, status, content) values (${id}, (select coalesce(max(number), 0) + 1 from issues), 'Scratch cover 243', 'classic', 'draft', ${sql.json(content)}) returning number`;
    assert(issue);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.addCookies([
      { name: "authjs.session-token", value: token, url: base },
    ]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.stack);
    });
    const stored = async () => {
      const [row] = await sql<
        { content: IssueContent }[]
      >`select content from issues where id = ${id}`;
      assert(row);
      return row.content;
    };
    const waitSaved = async (check: (c: IssueContent) => boolean) => {
      for (let i = 0; i < 100; i++) {
        if (check(await stored())) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("autosave did not reach expected content");
    };
    const edit = `${base}/admin/issues/${id}/edit`;
    await page.goto(edit);
    const canvas = page.locator("[data-page-frame]");
    const openCoverLayout = async () => {
      const done = page
        .getByRole("complementary", { name: "Cover element settings" })
        .getByRole("button", { name: "Done", exact: true });
      if (await done.count()) await done.click();
    };
    await canvas.locator('[data-block-id="photo"] img').click();
    await page
      .getByRole("button", {
        name: "Fill page (edge to edge, trims the photo)",
        exact: true,
      })
      .click();
    await page.locator('[data-cover-style="light-shadow"]').waitFor();
    assert.equal(await canvas.locator("[data-block-id]").count(), 3);
    assert.equal(
      await page.getByRole("button", { name: "Text", exact: true }).isEnabled(),
      true,
    );
    await waitSaved(
      (c) =>
        c.pages[0]!.blocks[1]!.type === "image" &&
        c.pages[0]!.blocks[1]!.align === "page-fill",
    );
    assert.equal(
      (await stored()).pages.length,
      3,
      "cover background must not move to another page",
    );
    const geometry = await canvas.evaluate((el) => {
      const photo = el
        .querySelector("[data-cover-background] img")!
        .getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      return [
        photo.x - frame.x,
        photo.y - frame.y,
        photo.width - frame.width,
        photo.height - frame.height,
      ];
    });
    assert(
      geometry.every((v) => Math.abs(v) < 1.1),
      `background covers canvas: ${geometry}`,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal(await page.locator(".cover-composition").count(), 0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.locator(".cover-composition").waitFor();
    const title = canvas
      .locator('[data-block-id="heading"] [data-cover-copy]')
      .last();
    const font = await title.evaluate((el) => getComputedStyle(el).fontFamily);
    await openCoverLayout();
    for (const style of styles) {
      const paint = resolveCoverAppearance(style);
      await page
        .getByRole("button", {
          name: `Background: ${paint.panel ? "panel" : "none"}`,
          exact: true,
        })
        .click();
      if (paint.panel)
        await page
          .getByRole("button", {
            name: `Panel colour: ${paint.background === "ink" ? "Charcoal" : "Paper"}`,
            exact: true,
          })
          .click();
      await page
        .getByRole("button", {
          name: `Element text colour: ${paint.text === "ink" ? "Charcoal" : "Paper"}`,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: `Text shadow: ${paint.shadow}`,
          exact: true,
        })
        .click();
      if (paint.shadow !== "none")
        await page
          .getByRole("button", {
            name: `Text shadow colour: ${paint.shadowColor === "ink" ? "Charcoal" : "Paper"}`,
            exact: true,
          })
          .click();
      assert.equal(
        await title.evaluate((el) => getComputedStyle(el).fontFamily),
        font,
      );
      const shadow = await title.evaluate(
        (el) => getComputedStyle(el).textShadow,
      );
      assert.equal(shadow !== "none", style.includes("shadow"));
    }
    await canvas.locator('[data-block-id="heading"]').click();
    for (const position of positions) {
      await page
        .getByRole("complementary", { name: "Cover element settings" })
        .getByRole("button", {
          name:
            position === "center"
              ? "Centre centre"
              : position === "top"
                ? "Top centre"
                : "Bottom centre",
          exact: true,
        })
        .click();
      assert.equal(
        await canvas
          .locator('[data-cover-entry="heading"]')
          .evaluate((el) => el.parentElement!.getAttribute("data-row")),
        position,
      );
    }
    await openCoverLayout();
    // Keyboard activation retains focus while changing the independent controls.
    const panelButton = page.getByRole("button", {
      name: "Background: panel",
      exact: true,
    });
    await panelButton.focus();
    await page.keyboard.press("Space");
    assert(await panelButton.evaluate((el) => el === document.activeElement));
    await waitSaved(
      (c) =>
        c.pages[0]!.coverOverlay?.appearance?.background === "ink" &&
        c.pages[0]!.blocks.some(
          (b) => b.type === "heading" && b.coverPlacement?.row === "bottom",
        ),
    );
    await page.reload();
    await canvas
      .locator(
        '.cover-placement-group[data-row="bottom"] [data-cover-entry="heading"]',
      )
      .waitFor();
    await openCoverLayout();
    await page
      .getByRole("button", { name: "Edit background image", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Fit page (the whole photo, with bars)",
        exact: true,
      })
      .click();
    assert.equal(
      await canvas
        .locator("[data-cover-background] img")
        .evaluate((el) => getComputedStyle(el).objectFit),
      "contain",
    );
    await page
      .getByRole("button", { name: "Normal image (resizable)", exact: true })
      .click();
    assert.equal(
      await canvas
        .locator('[data-block-id="photo"]')
        .evaluate((el) => (el as HTMLElement).style.width),
      "55%",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    assert.equal(await canvas.locator("[data-block-id]").count(), 4);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await openCoverLayout();
    await page
      .getByRole("button", { name: "Edit background image", exact: true })
      .click();
    await canvas
      .locator('[data-block-id="photo"]')
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    assert.equal(await canvas.locator("[data-cover-background]").count(), 0);
    assert.equal(await canvas.locator("[data-block-id]").count(), 2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitSaved(
      (c) =>
        c.pages[0]!.blocks.length === 3 &&
        c.pages[0]!.blocks[1]!.type === "image" &&
        c.pages[0]!.blocks[1]!.align === "page-fit",
    );
    await page.getByRole("button", { name: "3", exact: true }).click();
    await canvas.locator('[data-block-id="back-photo"] img').click();
    await page
      .getByRole("button", {
        name: "Fill page (edge to edge, trims the photo)",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Cover page", exact: true }).click();
    assert.equal(await page.locator(".cover-composition").count(), 0);
    assert.equal(await canvas.locator("[data-block-id]").count(), 3);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.locator(".cover-composition").waitFor();
    await page.getByRole("button", { name: "1", exact: true }).click();
    console.log("Checking cover reorder");
    // Demoting the front cover via the rail must preserve its content too.
    const from = await page
      .getByRole("button", { name: "1", exact: true })
      .boundingBox();
    const to = await page
      .getByRole("button", { name: "2", exact: true })
      .boundingBox();
    assert(from && to);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await waitSaved((c) => c.pages[0]!.id === "body");
    const reordered = await stored();
    assert.equal(reordered.pages[0]!.cover, true);
    assert.equal(reordered.pages[1]!.cover, false);
    assert.equal(
      reordered.pages[1]!.blocks[1]!.type === "image" &&
        reordered.pages[1]!.blocks[1]!.align,
      "full",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.locator(".cover-composition").waitFor();
    console.log("Checking cover overflow");
    // Overfull cover copy is warned about, never silently clipped in the editor.
    const tagline = page.getByRole("textbox", {
      name: "Add a tagline or date…",
      exact: true,
    });
    await tagline.fill(Array(30).fill("A longer cover line").join("\n"));
    await page
      .getByText("Cover content overflows — shorten or remove blocks", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page
      .getByText("Cover content overflows — shorten or remove blocks", {
        exact: true,
      })
      .waitFor({ state: "hidden" });
    console.log("Checking tablet controls");
    await page.setViewportSize({ width: 1024, height: 900 });
    await openCoverLayout();
    for (const name of [/^Background: panel$/, /^Add detail$/, /^Logo$/]) {
      const bounds = await page.getByRole("button", { name }).boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 1024);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await waitSaved(
      (c) =>
        c.pages[0]!.id === "cover" &&
        c.pages[2]!.cover === true &&
        c.pages[2]!.blocks[1]!.type === "image" &&
        c.pages[2]!.blocks[1]!.align === "page-fill" &&
        c.pages[0]!.blocks[2]!.type === "text" &&
        c.pages[0]!.blocks[2]!.text ===
          "September 2026 · Stories from our community",
    );
    await page.screenshot({ path: "/tmp/octavo-243-editor.png" });
    console.log(
      "PASS: editor geometry, overlays, controls, keyboard/focus, undo/redo, width restore, deletion, cover toggle, reordering, overflow and autosave/reload",
    );

    // Only publish this local scratch fixture, directly, so no emails are sent.
    await sql`update issues set status = 'published', published_at = now() where id = ${id}`;
    const saved = await stored();
    for (const align of ["page-fill", "page-fit"] as const) {
      const current: IssueContent = {
        ...saved,
        pages: [
          {
            ...setCoverBackground(saved.pages[0]!, "photo", align),
            coverOverlay: { style: "light-shadow", position: "top" },
          },
          ...saved.pages.slice(1),
        ],
      };
      await sql`update issues set content = ${sql.json(current)} where id = ${id}`;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}/read/${issue.number}`);
      const mobile = page.locator("section.cover-composition").first();
      await mobile.waitFor();
      const geom = await mobile.evaluate((el) => {
        const image = el.querySelector("img")!,
          a = image.getBoundingClientRect(),
          b = el.getBoundingClientRect();
        return {
          x: a.x,
          y: a.y,
          w: a.width,
          h: a.height,
          sh: b.height,
          fit: getComputedStyle(image).objectFit,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(geom.fit, align === "page-fill" ? "cover" : "contain");
      assert(
        Math.abs(geom.y - 52) < 1 &&
          geom.w === 390 &&
          geom.sh === 792 &&
          geom.h === geom.sh &&
          !geom.overflow,
        JSON.stringify(geom),
      );
      await page.screenshot({ path: `/tmp/octavo-243-mobile-${align}.png` });
      await page
        .getByRole("button", { name: "Larger text", exact: true })
        .click();
      assert.equal(
        await mobile
          .locator('[data-cover-entry="tagline"] [data-cover-copy]')
          .evaluate((el) => getComputedStyle(el).fontSize),
        "23px",
      );
      for (const theme of ["classic", "modern"]) {
        await sql`update issues set theme = ${theme} where id = ${id}`;
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}/read/${issue.number}`);
        await page.locator(".cover-composition").first().waitFor();
        const first = page.locator("[data-page-frame]:visible").first();
        assert.equal(await first.locator("[data-page-footer]").count(), 0);
        assert.equal(
          await first
            .locator('[data-reader-block="bleed"] img')
            .evaluate((el) => getComputedStyle(el).objectFit),
          align === "page-fill" ? "cover" : "contain",
        );
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page
          .getByRole("button", { name: "Previous", exact: true })
          .click();
        const printToken = createHash("sha256")
          .update(`${process.env.AUTH_SECRET}:pdf-print`)
          .digest("hex");
        await page.goto(
          `${base}/read/${issue.number}/print?token=${printToken}`,
          { waitUntil: "networkidle" },
        );
        await page.evaluate(() => document.fonts.ready);
        await page.emulateMedia({ media: "print" });
        const print = page.locator(".pdf-page").first();
        assert.equal(await print.locator("[data-page-footer]").count(), 0);
        assert.equal(
          await print
            .locator('[data-reader-block="bleed"] img')
            .evaluate((el) => getComputedStyle(el).objectFit),
          align === "page-fill" ? "cover" : "contain",
        );
        await page.pdf({
          path: `/tmp/octavo-243-${theme}-${align}.pdf`,
          printBackground: true,
          preferCSSPageSize: true,
        });
        await page.emulateMedia({ media: "screen" });
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: phone viewport Fill/Fit and text sizing, both desktop themes, page turns, print rendering and PDF generation",
    );
  } finally {
    await browser.close();
    await sql`delete from issues where id = ${id}`;
    await sql`delete from sessions where user_id = ${user}`;
    await sql`delete from users where id = ${user}`;
    await sql.end();
  }
}
