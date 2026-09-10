// Issue #238: schema/seed/flow/render regressions in memory; optionally exercise
// the real editor, autosave, readers and print route against a local dev server.
// npx tsx --tsconfig scripts/tsconfig.json scripts/dev-text-alignment-gate.mts [base-url]
// The browser pass needs DATABASE_URL + AUTH_SECRET (or .env.local), creates its
// own local scratch issue/admin and removes them in finally. Never runs the seed.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTENT_VERSION,
  issueContentSchema,
  textBlockSchema,
  type Block,
  type IssueContent,
  type TextAlign,
} from "../src/lib/blocks";
import { stringToDoc } from "../src/lib/rich-text-doc";
import { flowTextBlock } from "../src/features/editor/text-flow";
import { BlockView } from "../src/features/blocks/block-view";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { MobileBlock } from "../src/features/reader/mobile-block";
import { CoverThumb } from "../src/features/library/cover-thumb";
import { resolveTheme } from "../src/features/blocks/themes/registry";
import { DEFAULT_FOOTER_STYLE } from "../src/lib/branding";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const aligns = ["left", "center", "right", "justify"] as const;
const prose =
  "The alignment sample follows the author's choice across the magazine. " +
  "Members can read the editorial on a phone or a printed page, with the same " +
  "careful typography and generous spacing. This paragraph is long enough to " +
  "wrap onto several lines so that justification is visible.";
const legacy = { id: "legacy", type: "text", text: "An older plain paragraph" };
const paragraphs = (count: number) => ({
  type: "doc" as const,
  content: Array.from(
    { length: count },
    () => stringToDoc(prose).content,
  ).flat(),
});
assert.deepEqual(textBlockSchema.parse(legacy), legacy);
assert.equal(CONTENT_VERSION, 6, "optional alignment needs no content bump");
for (const align of ["full", "page-fill", "centre", "", null, 1]) {
  assert.equal(textBlockSchema.safeParse({ ...legacy, align }).success, false);
}

const seed = buildIssues(
  Object.fromEntries(
    SEED_IMAGES.map((s) => [s.key, `id-${s.key}`]),
  ) as SeedImages,
);
seed.forEach((issue) => issueContentSchema.parse(issue.content));
assert(
  seed.some((issue) =>
    issue.content.pages.some(
      (p) =>
        !p.cover &&
        p.blocks.some((b) => b.type === "text" && b.align === "justify"),
    ),
  ),
);
assert(
  seed[4]!.content.pages.some((p) =>
    p.blocks.some(
      (b) =>
        b.type === "text" &&
        typeof b.text === "string" &&
        b.align === undefined,
    ),
  ),
);

for (const align of aligns) {
  const block = textBlockSchema.parse({
    ...legacy,
    align,
    size: "l",
    text: paragraphs(3),
  });
  const pages = flowTextBlock(
    [{ id: "p", blocks: [block] }],
    0,
    block.id,
    [1, 2],
  );
  assert(pages);
  assert.equal(pages.length, 3);
  const saved = issueContentSchema.parse(
    JSON.parse(JSON.stringify({ version: 6, pages })),
  );
  assert.deepEqual(
    saved.pages
      .flatMap((p) => p.blocks)
      .map((b) => (b.type === "text" ? [b.align, b.size] : null)),
    Array(3).fill([align, "l"]),
  );
  assert.deepEqual(
    saved.pages
      .flatMap((p) => p.blocks)
      .flatMap((b) =>
        b.type === "text" && typeof b.text !== "string" ? b.text.content : [],
      ),
    typeof block.text !== "string" ? block.text.content : [],
  );

  for (const theme of ["classic", "modern"]) {
    const page = { id: "p", blocks: [block] };
    const shared = { theme: resolveTheme(theme), images: {}, sponsors: {} };
    const rendered = [
      createElement(PageBlocks, { ...shared, page }),
      createElement(MobileBlock, { block, m: 18, images: {}, sponsors: {} }),
      createElement(CoverThumb, {
        page,
        theme,
        images: {},
        sponsors: {},
        issueNo: 1,
        width: 150,
        settings: {
          name: "Magazine",
          org: "Club",
          tagline: "",
          footer: DEFAULT_FOOTER_STYLE,
          pdfDownloads: false,
        },
      }),
    ].map((element) => renderToStaticMarkup(element));
    for (const [surface, html] of rendered.entries()) {
      assert(html.includes(`text-${align}`));
      const mobile = surface === 1;
      assert.equal(
        html.includes("hyphens-auto"),
        mobile && align === "justify",
      );
      assert.equal(
        html.includes("hyphens-none"),
        !mobile && align === "justify",
      );
    }
    for (const edit of [undefined, { onChange: () => {} }]) {
      const cover = renderToStaticMarkup(
        createElement(BlockView, {
          ...shared,
          block,
          variant: "cover",
          edit,
        }),
      );
      assert(cover.includes("text-center"));
      assert(!cover.includes("hyphens-auto"));
    }
    const mobileCover = (b: Block) =>
      renderToStaticMarkup(
        createElement(MobileBlock, {
          block: b,
          m: 18,
          images: {},
          sponsors: {},
          cover: true,
        }),
      );
    assert.equal(
      mobileCover(block),
      mobileCover({ ...block, align: undefined }),
    );
  }
}
console.log(
  "PASS: schema compatibility, seed, flow round-trip, both themes, thumbnails and cover exceptions",
);

const base = process.argv[2];
if (base) await browserPass(base);

async function browserPass(base: string) {
  assert(
    ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
    "local server only",
  );
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { default: postgres } = await import("postgres");
  const { chromium } = await import("playwright");
  const { createHash } = await import("node:crypto");
  const sql = postgres(process.env.DATABASE_URL!);
  const id = crypto.randomUUID();
  const user = crypto.randomUUID();
  const token = crypto.randomUUID();
  const browser = await chromium.launch();
  try {
    const content: IssueContent = {
      version: CONTENT_VERSION,
      pages: [
        {
          id: "cover",
          cover: true,
          blocks: [
            {
              id: "tagline",
              type: "text",
              text: "Cover tagline",
              align: "right",
            },
          ],
        },
        {
          id: "body",
          blocks: [{ id: "body-text", type: "text", text: stringToDoc(prose) }],
        },
        {
          id: "overflow",
          blocks: [
            {
              id: "long-text",
              type: "text",
              align: "justify",
              text: paragraphs(16),
            },
          ],
        },
      ],
    };
    await sql`insert into users (id, email, is_admin, subscribed, email_verified)
      values (${user}, ${`scratch-238-${user}@example.invalid`}, true, true, now())`;
    await sql`insert into sessions (session_token, user_id, expires)
      values (${token}, ${user}, now() + interval '1 hour')`;
    const [issue] = await sql<
      { number: number }[]
    >`insert into issues (id, number, title, theme, status, content)
      values (${id}, (select coalesce(max(number), 0) + 1 from issues), 'Scratch alignment 238',
      'classic', 'draft', ${sql.json(content)}) returning number`;
    assert(issue);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.addCookies([
      { name: "authjs.session-token", value: token, url: base },
    ]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const editUrl = `${base}/admin/issues/${id}/edit`;
    await page.goto(editUrl);
    await page.locator('[data-block-id="tagline"]').click();
    assert.equal(
      await page.getByRole("group", { name: "Text alignment" }).count(),
      0,
    );
    assert.equal(
      await page
        .locator('[data-block-id="tagline"] p')
        .evaluate((el) => getComputedStyle(el).textAlign),
      "center",
    );
    await page.getByRole("button", { name: "2", exact: true }).click();
    const body = page.locator('[data-block-id="body-text"] [data-text-body]');
    await body.click();
    assert.equal(
      await page
        .getByRole("button", { name: "Align left", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    const titles: Record<TextAlign, string> = {
      left: "Align left",
      center: "Align centre",
      right: "Align right",
      justify: "Justify text",
    };
    const stored = async () => {
      const [row] = await sql<
        { content: IssueContent }[]
      >`select content from issues where id = ${id}`;
      assert(row);
      return row.content;
    };
    const waitSaved = async (check: (c: IssueContent) => boolean) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (check(await stored())) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("autosave did not reach expected content");
    };
    for (const align of aligns) {
      const button = page.getByRole("button", {
        name: titles[align],
        exact: true,
      });
      await button.focus();
      await page.keyboard.press(align === "center" ? "Space" : "Enter");
      await page.waitForFunction((value) => {
        const el = document.querySelector(
          '[data-block-id="body-text"] [data-text-body]',
        );
        return el && getComputedStyle(el).textAlign === value;
      }, align);
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      if (align === "justify") {
        assert.equal(
          await body.evaluate((el) => getComputedStyle(el).hyphens),
          "none",
        );
      }
      assert.equal(
        await page
          .getByRole("group", { name: "Text alignment" })
          .locator('[aria-pressed="true"]')
          .count(),
        1,
      );
      const focus = await button.evaluate((el) => {
        const css = getComputedStyle(el);
        return {
          visible: el.matches(":focus-visible"),
          width: css.outlineWidth,
          color: css.outlineColor,
          background: css.backgroundColor,
          offset: css.outlineOffset,
        };
      });
      assert(
        focus.visible &&
          focus.width === "2px" &&
          focus.offset === "-2px" &&
          focus.color !== focus.background,
        `visible inset focus for ${align}: ${JSON.stringify(focus)}`,
      );
      await waitSaved((c) => {
        const b = c.pages[1]!.blocks[0]!;
        return b.type === "text" && b.align === align;
      });
    }
    await page.reload();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await body.click();
    assert.equal(
      await body.evaluate((el) => getComputedStyle(el).textAlign),
      "justify",
    );
    await page.evaluate(() => document.fonts.ready);
    const editorBodyHeight = await body.evaluate(
      (el) => (el as HTMLElement).offsetHeight,
    );
    await page.screenshot({ path: "/tmp/octavo-238-editor.png" });
    await page.setViewportSize({ width: 1024, height: 900 });
    const toolbar = page.getByRole("group", { name: "Text alignment" });
    const buttons = toolbar.locator("button");
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      assert(
        box && box.x >= 0 && box.x + box.width <= 1024,
        "alignment controls fit tablet viewport",
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page
      .locator('[data-block-id="long-text"] [data-text-body]')
      .click({ position: { x: 20, y: 20 } });
    await page
      .getByRole("button", { name: "Flow onto next page", exact: true })
      .click();
    await waitSaved((c) => c.pages.length > 3);
    const flowed = await stored();
    const chunks = flowed.pages.slice(2).flatMap((p) => p.blocks);
    assert(
      chunks.length > 1 &&
        chunks.every((b) => b.type === "text" && b.align === "justify"),
    );
    assert.equal(
      chunks.flatMap((b) =>
        b.type === "text" && typeof b.text !== "string" ? b.text.content : [],
      ).length,
      16,
    );
    console.log(
      "PASS: keyboard controls, focus/active state, immediate canvas update, autosave/reload, tablet fit and measured overflow",
    );

    // Publish only the local scratch fixture through SQL: no publish action/email.
    await sql`update issues set status = 'published', published_at = now() where id = ${id}`;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/read/${issue.number}`);
      const tagline = page.getByText("Cover tagline", { exact: true }).first();
      assert.equal(
        await tagline.evaluate((el) => getComputedStyle(el).textAlign),
        "center",
      );
      if (width === 1440)
        await page.getByRole("button", { name: "Next", exact: true }).click();
      const text = page
        .locator(".rich-text")
        .filter({ hasText: prose })
        .first();
      await text.waitFor({ state: "attached" });
      assert.deepEqual(
        await text.evaluate((el) => ({
          align: getComputedStyle(el).textAlign,
          hyphens: getComputedStyle(el).hyphens,
        })),
        { align: "justify", hyphens: width === 390 ? "auto" : "none" },
      );
      if (width === 390)
        await page.screenshot({
          path: "/tmp/octavo-238-mobile.png",
          fullPage: true,
        });
    }
    const printToken = createHash("sha256")
      .update(`${process.env.AUTH_SECRET}:pdf-print`)
      .digest("hex");
    await page.goto(`${base}/read/${issue.number}/print?token=${printToken}`, {
      waitUntil: "networkidle",
    });
    await page.emulateMedia({ media: "print" });
    await page.locator(".pdf-pages").waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    const printBodies = await page.locator(".rich-text").all();
    assert.equal(printBodies.length, flowed.pages.length - 1);
    assert.equal(
      await printBodies[0]!.evaluate((el) => (el as HTMLElement).offsetHeight),
      editorBodyHeight,
      "the printed paragraph has the editor's measured height",
    );
    for (const body of printBodies) {
      assert.deepEqual(
        await body.evaluate((el) => ({
          align: getComputedStyle(el).textAlign,
          hyphens: getComputedStyle(el).hyphens,
        })),
        { align: "justify", hyphens: "none" },
      );
      assert(
        await body.evaluate((el) => {
          const footer = el
            .closest(".pdf-page")
            ?.querySelector("[data-page-footer]");
          return (
            footer &&
            el.getBoundingClientRect().bottom <=
              footer.getBoundingClientRect().top - 5
          );
        }),
        "flowed print text stays above the footer gutter",
      );
    }
    const pdf = await page.pdf({
      path: "/tmp/octavo-238.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert(pdf.subarray(0, 5).toString() === "%PDF-");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: desktop/mobile hyphenation, centred cover, editor/print height and footer clearance, actual PDF; no browser exceptions",
    );
  } finally {
    await browser.close();
    await sql`delete from issues where id = ${id}`;
    await sql`delete from sessions where user_id = ${user}`;
    await sql`delete from users where id = ${user}`;
    await sql.end();
  }
}
