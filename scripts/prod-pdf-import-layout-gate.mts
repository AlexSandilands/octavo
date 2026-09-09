// Additional measured-layout coverage. Uses only its own local scratch records.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  base,
  sql,
  browser,
  iid,
  token,
  prefixId,
  initial,
  setup,
  cleanup,
  readDocument,
  openFile,
  waitAdded,
  assertFits,
} from "./pdf-import-gate-support.mts";

// A deliberately extreme, ordinary JPEG occurrence: no crop/mask/vector fallback.
async function tallFixture(directory: string) {
  const jpeg = await sharp({
    create: {
      width: 100,
      height: 2400,
      channels: 3,
      background: { r: 30, g: 100, b: 70 },
    },
  })
    .jpeg()
    .toBuffer();
  const stream = [
    "BT /F1 18 Tf 1 0 0 1 100 730 Tm (A tall photograph) Tj ET",
    "BT /F1 12 Tf 1 0 0 1 100 690 Tm (Body content before the photograph.) Tj ET",
    "q 30 0 0 720 40 40 cm /Im1 Do Q",
  ].join("\n");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>",
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 100 /Height 2400 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ),
  ];
  const chunks = [Buffer.from("%PDF-1.7\n")];
  const offsets: number[] = [];
  let length = chunks[0]!.length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  }
  chunks.push(
    Buffer.from(
      `xref\n0 7\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  const path = join(directory, "tall-photo.pdf");
  await writeFile(path, Buffer.concat(chunks));
  return path;
}

const directory = await mkdtemp(join(tmpdir(), "octavo-pdf-layout-"));
const logoId = crypto.randomUUID();
let logoCreated = false;
try {
  await setup();
  const fixture = await tallFixture(directory);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const logo = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "#246544" },
  })
    .png()
    .toBuffer();
  const upload = await context.request.post(`${base}/api/admin/images`, {
    multipart: {
      issueId: iid,
      file: { name: "scratch-logo.png", mimeType: "image/png", buffer: logo },
    },
  });
  assert.equal(upload.status(), 200);
  const uploaded = (await upload.json()) as { imageId: string };
  await sql`insert into logos(id,name,image_id) values(${logoId},'PDF layout scratch mark',${uploaded.imageId})`;
  logoCreated = true;
  const page = await context.newPage();
  const heights: number[] = [];
  let imageRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/admin/images")
    )
      imageRequests++;
  });
  for (const theme of ["classic", "modern"]) {
    for (const reserve of [
      { mark: 12, text: 8 },
      { mark: 48, text: 16 },
    ]) {
      await sql`update issues set content=${sql.json(initial)},status='draft',theme=${theme},logo_id=${logoId},footer_mark_size=${reserve.mark},footer_text_size=${reserve.text},revision=revision+1 where id=${iid}`;
      await page.goto(`${base}/admin/issues/${iid}/edit`);
      await page
        .getByRole("button", { name: "Magazine page 2", exact: true })
        .click();
      await page.locator(`[data-block-id="${prefixId}"]`).click();
      heights.push(
        await page
          .locator("[data-page-footer]")
          .evaluate((el) => (el as HTMLElement).offsetHeight),
      );
      await page
        .getByRole("button", { name: "Import PDF", exact: true })
        .click();
      await openFile(page, fixture);
      await page
        .getByRole("button", { name: "Select text on this page", exact: true })
        .click();
      await page.getByRole("button", { name: /^Image region/ }).click();
      await page
        .getByRole("textbox", { name: "Editable text preview", exact: true })
        .first()
        .fill(
          "Measured footer text remains before the photograph. ".repeat(100),
        );
      await page
        .getByRole("button", { name: "Add to magazine", exact: true })
        .click();
      await page.waitForFunction(
        () => !document.querySelector('[data-import-pending="true"]'),
        undefined,
        { timeout: 45000 },
      );
      const status = await page
        .locator('[data-pdf-private] [role="status"]')
        .innerText();
      await page.screenshot({ path: "/tmp/pdf-import-tall-layout.png" });
      assert.match(
        status,
        /^Added to the magazine\./,
        `${theme}, footer ${reserve.mark}/${reserve.text}: ${status}`,
      );
      await waitAdded(page);
      const doc = await readDocument();
      assert.deepEqual(doc.pages.at(-1), initial.pages.at(-1));
      const photoPage = doc.pages.findIndex((p) =>
        p.blocks.some((b) => b.type === "image" && b.align === "page-fit"),
      );
      assert(
        photoPage > 1,
        "An image too tall at minimum inline width gets a dedicated fit page.",
      );
      assert.equal(doc.pages[photoPage]!.blocks.length, 1);
      for (let index = 1; index < doc.pages.length; index++) {
        await page
          .getByRole("button", {
            name: `Magazine page ${index + 1}`,
            exact: true,
          })
          .click();
        if (index === photoPage) {
          assert.equal(await page.locator("[data-page-footer]").count(), 0);
          const image = page.locator("[data-page-frame] img").first();
          await image.evaluate(async (el) => {
            await (el as HTMLImageElement).decode();
          });
          assert.equal(
            await image.evaluate((el) => getComputedStyle(el).objectFit),
            "contain",
          );
          const aspect = await image.evaluate(
            (el) =>
              (el as HTMLImageElement).naturalHeight /
              (el as HTMLImageElement).naturalWidth,
          );
          // The shared pipeline caps at 2000px, rounding the other dimension.
          assert(Math.abs(aspect / 24 - 1) < 0.01);
        } else await assertFits(page);
      }
      await page.reload();
      await page
        .getByRole("button", {
          name: `Magazine page ${photoPage + 1}`,
          exact: true,
        })
        .click();
      await page
        .locator("[data-page-frame] img")
        .first()
        .evaluate(async (el) => {
          const img = el as HTMLImageElement;
          await img.decode();
          if (!img.naturalWidth)
            throw new Error("Reloaded imported image is missing.");
        });
    }
  }
  assert(
    heights[0]! < heights[1]! && heights[2]! < heights[3]!,
    "Both themes exercised different effective footer reserves.",
  );
  const full = {
    ...initial,
    pages: [
      ...initial.pages,
      ...Array.from({ length: 197 }, () => ({
        id: crypto.randomUUID(),
        blocks: [],
      })),
    ],
  };
  await sql`update issues set content=${sql.json(full)},status='draft',revision=revision+1 where id=${iid}`;
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await page
    .getByRole("button", { name: "Magazine page 2", exact: true })
    .click();
  await page.locator(`[data-block-id="${prefixId}"]`).click();
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await openFile(page, fixture);
  await page
    .getByRole("button", { name: "Select text on this page", exact: true })
    .click();
  await page.getByRole("button", { name: /^Image region/ }).click();
  const before = imageRequests;
  await page
    .getByRole("button", { name: "Add to magazine", exact: true })
    .click();
  await page
    .getByText(/200 magazine pages|exceeds magazine content limits/)
    .waitFor({ timeout: 45000 });
  assert.deepEqual((await readDocument()).pages, full.pages);
  assert.equal(
    imageRequests,
    before,
    "Page-limit refusal happens before image upload.",
  );
  assert(
    (await page
      .getByRole("textbox", { name: "Editable text preview", exact: true })
      .count()) > 0,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      tallImage: "page-fit, uncropped, reloads",
      themes: 2,
      footerHeights: heights,
      pageLimit: "unchanged, no upload",
    }),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  if (logoCreated) await sql`delete from logos where id=${logoId}`;
  await cleanup();
  await rm(directory, { recursive: true, force: true });
}
process.exit(0);
