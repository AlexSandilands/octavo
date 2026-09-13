// Local scratch issue only; verifies caption authoring, readers and print (#280).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import {
  CONTENT_VERSION,
  issueContentSchema,
  type IssueContent,
} from "../src/lib/blocks";

const base = process.argv[2] ?? "http://localhost:3028";
const shared = "A weekend with the camera club.";
const first = "Members gather beside the clubhouse.";
const second =
  "At the end of the afternoon, members gather around the clubhouse to compare photographs, share stories from the walk and plan the next outing together. A longer caption should fit without moving the next block.";
const montage = (content: IssueContent) => {
  const block = content.pages[0]?.blocks.find((b) => b.type === "montage");
  assert(block?.type === "montage");
  return block;
};

await withCoverFixture(base, async (fixture) => {
  const { page, sql, id, number, edit, stored, waitSaved, errors } = fixture;
  const photos = await sql<{ id: string }[]>`
    select id from images where key like 'seed/%' order by key limit 3
  `;
  assert.equal(photos.length, 3);
  const content = issueContentSchema.parse({
    version: 7,
    pages: [
      {
        id: "montage-page",
        cover: false,
        blocks: [
          {
            id: "caption-montage",
            type: "montage",
            caption: shared,
            interval: 3,
            align: "full",
            width: 75,
            items: photos.map((photo, i) => ({
              imageId: photo.id,
              alt: `Original description ${i + 1}`,
            })),
          },
          {
            id: "after-montage",
            type: "heading",
            title: "After the montage",
            level: "paragraph",
          },
        ],
      },
    ],
  });
  await sql`update issues set content=${sql.json(content)} where id=${id}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(edit);
  const block = page.locator('[data-block-id="caption-montage"]');
  await block.click();
  assert(
    (await block.innerText()).includes(shared),
    "legacy caption remains on canvas",
  );
  const trigger = page.getByRole("button", { name: /Edit montage \(/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Montage", exact: true });
  const caption = (i: number) =>
    dialog.getByRole("textbox", {
      name: new RegExp(`Caption.*image ${i} of 3`, "i"),
    });
  assert.equal(await dialog.getAttribute("aria-modal"), "true");
  assert(await caption(1).isDisabled());
  await dialog
    .getByRole("button", { name: "Use captions per image", exact: true })
    .click();
  await waitSaved(
    (c) =>
      montage(c).caption === "" &&
      montage(c).items.every((it) => it.caption === shared),
  );
  await caption(1).fill(first);
  await caption(2).fill(second);
  await caption(3).fill("");
  await waitSaved(
    (c) =>
      montage(c).items[0]?.caption === first &&
      montage(c).items[1]?.caption === second &&
      montage(c).items[2]?.caption === "",
  );
  assert.equal(montage(await stored()).items[0]?.alt, "Original description 1");
  await dialog.locator("summary").first().click();
  const alt = dialog.getByRole("textbox", {
    name: "Alt text for image 1 of 3",
    exact: true,
  });
  assert.equal(await alt.inputValue(), "Original description 1");
  await alt.fill("Members stand in front of the wooden clubhouse.");
  await waitSaved(
    (c) =>
      montage(c).items[0]?.alt ===
      "Members stand in front of the wooden clubhouse.",
  );
  await dialog.locator("summary").first().click();
  await page.screenshot({ path: "/tmp/octavo-montage-captions-desktop.png" });

  // Reordering carries both fields with the photo; the editor history restores it.
  await dialog
    .getByRole("button", { name: "Move image 1 of 3 later", exact: true })
    .click();
  await waitSaved((c) => montage(c).items[1]?.caption === first);
  await page.keyboard.press("Escape");
  assert(await trigger.evaluate((el) => el === document.activeElement));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSaved((c) => montage(c).items[0]?.caption === first);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitSaved((c) => montage(c).items[1]?.caption === first);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSaved((c) => montage(c).items[0]?.caption === first);
  await page.reload();
  await block.click();
  assert.equal(
    await block.locator('[contenteditable="true"]').count(),
    0,
    "no montage-wide caption input on canvas",
  );
  await trigger.click();
  assert.equal(await caption(1).inputValue(), first);
  // Fast edits to different photos and a reorder must remain separate undo steps.
  await caption(1).fill("First quick edit");
  await caption(2).fill("Second quick edit");
  await dialog
    .getByRole("button", { name: "Move image 1 of 3 later", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await trigger.click();
  assert.equal(await caption(1).inputValue(), "First quick edit");
  assert.equal(await caption(2).inputValue(), "Second quick edit");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await trigger.click();
  assert.equal(await caption(1).inputValue(), "First quick edit");
  assert.equal(await caption(2).inputValue(), second);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await trigger.click();
  assert.equal(await caption(1).inputValue(), first);
  await waitSaved(
    (c) =>
      montage(c).items[0]?.caption === first &&
      montage(c).items[1]?.caption === second,
  );
  for (const width of [1024, 768]) {
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await block.click();
    await trigger.click();
    const bounds = await dialog.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
    await caption(1).focus();
    await page.screenshot({
      path: `/tmp/octavo-montage-captions-${width}.png`,
    });
  }
  // An upload completing after a caption edit must append to the current items.
  let releaseUpload = () => {};
  const uploadHold = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await page.route("**/api/admin/images", async (route) => {
    await uploadHold;
    await route.fulfill({
      json: {
        imageId: fixture.imageId,
        url: `/api/images/${fixture.path.split("/").at(-1)}`,
        width: 240,
        height: 120,
      },
    });
  });
  await dialog.locator('input[type="file"]').setInputFiles(fixture.path);
  await caption(1).fill("Caption edited while uploading.");
  assert(
    await dialog
      .getByRole("button", { name: "Close", exact: true })
      .isDisabled(),
  );
  await page.keyboard.press("Escape");
  assert(await dialog.isVisible(), "pending upload keeps its editor mounted");
  releaseUpload();
  await dialog
    .getByRole("button", { name: "Remove image 4 of 4", exact: true })
    .waitFor();
  await waitSaved(
    (c) =>
      montage(c).items.length === 4 &&
      montage(c).items[0]?.caption === "Caption edited while uploading.",
  );
  await dialog
    .getByRole("button", { name: "Remove image 4 of 4", exact: true })
    .click();
  await caption(1).fill(first);
  await waitSaved(
    (c) =>
      montage(c).items.length === 3 && montage(c).items[0]?.caption === first,
  );
  await page.unroute("**/api/admin/images");
  await page.keyboard.press("Escape");
  const saved = await stored();
  assert.equal(saved.version, CONTENT_VERSION);
  await page.goto(`${base}/admin`);
  await sql`update issues set status='published', published_at=now(), content=${sql.json(saved)} where id=${id}`;

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/read/${number}`);
    const player = page
      .getByRole("group", { name: "Image montage", exact: true })
      .filter({ visible: true });
    await player.waitFor();
    await player.scrollIntoViewIfNeeded();
    const figure = player.locator("xpath=ancestor-or-self::figure[1]");
    const visibleText = () => figure.innerText();
    assert((await visibleText()).includes(first));
    assert(!(await visibleText()).includes(second));
    const height = await figure.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    await player
      .getByRole("button", { name: "Next image", exact: true })
      .click();
    assert((await visibleText()).includes(second));
    assert(!(await visibleText()).includes(first));
    assert.equal(
      await figure.evaluate((el) => el.getBoundingClientRect().height),
      height,
    );
    await page.keyboard.press("ArrowRight");
    assert(
      !(await visibleText()).includes(first) &&
        !(await visibleText()).includes(second),
    );
    assert.equal(
      await figure.evaluate((el) => el.getBoundingClientRect().height),
      height,
    );
    await page.keyboard.press("ArrowLeft");
    assert((await visibleText()).includes(second));
    await page.screenshot({ path: `/tmp/octavo-montage-reader-${width}.png` });
    const snapshot = await figure.ariaSnapshot();
    assert(snapshot.includes(second));
    assert(
      !snapshot.includes(first),
      "inactive caption is hidden from screen readers",
    );
    assert(snapshot.includes("Original description 2"));
  }
  console.log(
    "PASS: migration, individual captions, persistence, history, responsive dialog and manual readers",
  );

  // Real timer, with pointer and focus outside the montage.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.mouse.move(0, 0);
  await page.goto(`${base}/read/${number}`);
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll("figure")].some((el) =>
        el.innerText.includes(text),
      ),
    second,
    { timeout: 15000 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const player = page
    .getByRole("group", { name: "Image montage", exact: true })
    .filter({ visible: true });
  await player.waitFor();
  await page.waitForTimeout(3500);
  assert(
    (
      await player.locator("xpath=ancestor-or-self::figure[1]").innerText()
    ).includes(first),
  );
  console.log("PASS: autoplay caption synchronisation and reduced motion");

  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  for (const theme of ["classic", "modern"]) {
    await page.goto(
      `${base}/read/${number}/print?token=${token}&theme=${theme}`,
      { waitUntil: "networkidle" },
    );
    assert.equal(
      await page.getByRole("button", { name: "Next image" }).count(),
      0,
    );
    const printed = await page.locator("body").innerText();
    assert(printed.includes(first) && !printed.includes(second));
    const path = `/tmp/octavo-montage-captions-${theme}.pdf`;
    await page.pdf({ path, printBackground: true, preferCSSPageSize: true });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    assert(
      text.includes(first) && !text.includes(second),
      "PDF prints only first caption",
    );
    await page.screenshot({ path: `/tmp/octavo-montage-print-${theme}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: deterministic first caption in both PDF themes; no browser errors",
  );
});
