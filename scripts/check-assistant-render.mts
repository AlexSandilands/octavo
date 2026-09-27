// The assistant's page pictures and photos (#342) against a running server with
// the assistant on (dev or production, Chromium installed):
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3342 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-render.mts http://localhost:3342
// It renders every page of every seed issue from a scratch draft copy and checks
// each measured fill against the editor's own overflow marker on that page;
// renders a page with an unsaved edit (the picture and the fill change, the
// database doesn't); and checks the refusals: a published issue, a member, a
// cross-site request, an oversized body, a third render at once; a logo-library
// mark and another issue's photo for view_photo.
//
// SAFETY: shared dev database. It mints its own admin, member, sessions and one
// draft copy per seed issue; the finally deletes exactly those rows.
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import {
  AI_PHOTO_PATH,
  AI_RENDER_MAX_BYTES,
  AI_RENDER_PATH,
  AI_REVIEW_MAX_PAGES,
  type AiRenderResponse,
} from "../src/lib/ai-vision-contract";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: check-assistant-render.mts <url>");
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local test server.",
);
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `render-check-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const memberId = crypto.randomUUID();
const adminToken = crypto.randomUUID();
const memberToken = crypto.randomUUID();
const drafts: string[] = [];

type Content = {
  version: number;
  pages: { id: string; cover?: boolean; blocks: Block[] }[];
};
type Block = { id: string; type: string; [k: string]: unknown };
type Issue = {
  id: string;
  number: number;
  theme: string;
  logo_id: string | null;
  content: Content;
};

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

async function post(
  path: string,
  body: unknown,
  token = adminToken,
  origin = base,
) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `authjs.session-token=${token}`,
      ...(origin ? { origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const renderBody = (
  issue: Issue,
  id: string,
  content: Content,
  pages: number[],
) => ({
  issueId: id,
  theme: issue.theme,
  logoId: issue.logo_id,
  content,
  pages,
});
async function render(
  issue: Issue,
  id: string,
  content: Content,
  pages: number[],
) {
  const res = await post(AI_RENDER_PATH, renderBody(issue, id, content, pages));
  assert.equal(res.status, 200, `render answered ${res.status}`);
  return ((await res.json()) as AiRenderResponse).pages;
}

async function readContent(id: string): Promise<Content> {
  const [row] = await sql<{ content: Content }[]>`
    select content from issues where id = ${id}`;
  return row!.content;
}

/** The editor's overflow marker on each page (1-based), as the author sees it. */
async function editorMarkers(page: Page, id: string, count: number) {
  await page.goto(`${base}/admin/issues/${id}/edit`);
  await page.waitForSelector('nav[aria-label="Editor panels"]');
  const marked: boolean[] = [];
  for (let n = 1; n <= count; n++) {
    await page.click(`button[aria-label^="Page ${n}"]`);
    await page.waitForTimeout(400);
    marked[n] = await page.$$eval(
      "[data-editor-canvas-stage] .border-dashed.border-warn",
      (els) => els.length > 0,
    );
  }
  return marked;
}

async function checks(page: Page) {
  const seeds = await sql<Issue[]>`
    select id, number, theme, logo_id, content from issues
    where status = 'published' and title not like 'Spike%'
    order by number limit 6`;
  ok(seeds.length > 0, `${seeds.length} published issues to copy`);

  heading("Every seed page: the picture's fill against the editor's marker");
  let pages = 0;
  let overflowing = 0;
  for (const seed of seeds) {
    // One overflowing page of body text on the end, so both answers are seen.
    const long = Array.from({ length: 30 }, (_, i) =>
      para(
        `Paragraph ${i + 1}. ${"The club met on the green at dawn. ".repeat(6)}`,
      ),
    );
    const content: Content = {
      ...seed.content,
      pages: [
        ...seed.content.pages,
        {
          id: crypto.randomUUID(),
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "text",
              text: { type: "doc", content: long },
            },
          ],
        },
      ],
    };
    const id = crypto.randomUUID();
    drafts.push(id);
    await sql`insert into issues (id, title, theme, status, content, logo_id,
        footer_mark_size, footer_text_size)
      select ${id}, ${`${tag} · ${seed.number}`}, theme, 'draft',
        ${sql.json(content as never)}, logo_id, footer_mark_size, footer_text_size
      from issues where id = ${seed.id}`;
    const count = content.pages.length;
    const all = Array.from({ length: count }, (_, i) => i + 1);
    const shots = [];
    for (let i = 0; i < all.length; i += AI_REVIEW_MAX_PAGES)
      shots.push(
        ...(await render(
          seed,
          id,
          content,
          all.slice(i, i + AI_REVIEW_MAX_PAGES),
        )),
      );
    ok(
      shots.length === count &&
        shots.every(
          (s, i) =>
            s.page === i + 1 &&
            s.cover === Boolean(content.pages[i]!.cover) &&
            s.data.length > 1000,
        ),
      `issue ${seed.number}: ${count} pictures, in order`,
    );
    const marked = await editorMarkers(page, id, count);
    for (const shot of shots) {
      if (!shot.fill) {
        ok(
          !marked[shot.page],
          `issue ${seed.number} p${shot.page}: no fill (cover or photo page), no marker`,
        );
        continue;
      }
      const over = shot.fill.used > shot.fill.avail;
      const pct = Math.round((shot.fill.used / shot.fill.avail) * 100);
      ok(
        over === marked[shot.page],
        `issue ${seed.number} p${shot.page}: ${pct}% — ${over ? "overflows" : "fits"}, and the editor ${marked[shot.page] ? "marks it" : "doesn't mark it"}`,
      );
      pages++;
      if (over) overflowing++;
    }
  }
  ok(
    overflowing >= seeds.length,
    `${pages} measured pages agree, ${overflowing} of them overflowing`,
  );

  heading("An unsaved edit shows");
  const seed = seeds[0]!;
  const id = drafts[0]!;
  const saved = await readContent(id);
  const n =
    saved.pages.findIndex(
      (p) => !p.cover && p.blocks.some((b) => b.type === "heading"),
    ) + 1;
  ok(n > 0, `page ${n} has a heading to edit`);
  const [before] = await render(seed, id, saved, [n]);
  const edited: Content = structuredClone(saved);
  const head = edited.pages[n - 1]!.blocks.find((b) => b.type === "heading")!;
  head.title =
    "An unsaved headline that runs on long enough to take a second line";
  edited.pages[n - 1]!.blocks.push({
    id: crypto.randomUUID(),
    type: "text",
    text: {
      type: "doc",
      content: [para("A new paragraph nobody has saved yet.")],
    },
  });
  const [after] = await render(seed, id, edited, [n]);
  ok(before!.data !== after!.data, "the picture changes");
  ok(
    before!.fill && after!.fill && after!.fill.used > before!.fill.used,
    `and the page is fuller: ${before!.fill?.used} → ${after!.fill?.used}px`,
  );
  ok(
    JSON.stringify(await readContent(id)) === JSON.stringify(saved),
    "the database is untouched",
  );

  heading("Refusals");
  const body = renderBody(seed, id, saved, [1]);
  ok(
    (await post(AI_RENDER_PATH, { ...body, issueId: seed.id })).status === 409,
    "a published issue: 409",
  );
  ok(
    (await post(AI_RENDER_PATH, body, memberToken)).status === 403,
    "a member: 403",
  );
  ok(
    (await post(AI_RENDER_PATH, body, adminToken, "")).status === 403,
    "no Origin: 403",
  );
  ok(
    (await post(AI_RENDER_PATH, body, adminToken, "https://evil.example"))
      .status === 403,
    "another origin: 403",
  );
  const padded = JSON.stringify({
    ...body,
    pad: "x".repeat(AI_RENDER_MAX_BYTES),
  });
  ok(
    (await post(AI_RENDER_PATH, padded)).status === 413,
    "an oversized body: 413",
  );
  ok(
    (await post(AI_RENDER_PATH, { ...body, pages: [] })).status === 400,
    "no pages: 400",
  );
  ok(
    (
      await post(AI_RENDER_PATH, {
        ...body,
        pages: Array.from({ length: 9 }, (_, i) => i + 1),
      })
    ).status === 400,
    "nine pages: 400",
  );
  const broken = structuredClone(saved);
  broken.pages[0]!.blocks.push({ id: "x", type: "no-such-block" });
  ok(
    (await post(AI_RENDER_PATH, { ...body, content: broken })).status === 400,
    "content the save path would refuse: 400",
  );

  heading("Two renders at once; a third is turned away");
  const three = await Promise.all(
    [0, 1, 2].map(() => post(AI_RENDER_PATH, { ...body, pages: [1, 2, 3] })),
  );
  const codes = three.map((r) => r.status).sort();
  ok(codes.join() === "200,200,503", `three in parallel: ${codes.join(", ")}`);
  const busy = three.find((r) => r.status === 503)!;
  ok(
    busy.headers.get("retry-after") === "5" &&
      /^Too many pages/.test(((await busy.json()) as { error: string }).error),
    "the third says so, with Retry-After",
  );
  ok(
    (await post(AI_RENDER_PATH, body)).status === 200,
    "and the slots are free again afterwards",
  );

  heading("view_photo's photos");
  const placed = JSON.stringify(saved).match(/"imageId":"([^"]+)"/)?.[1];
  ok(placed, "the copy places a photo");
  const photo = await post(AI_PHOTO_PATH, { issueId: id, imageId: placed });
  const shot = (await photo.json()) as {
    width: number;
    height: number;
    mediaType: string;
  };
  ok(
    photo.status === 200 &&
      shot.mediaType === "image/jpeg" &&
      Math.max(shot.width, shot.height) <= 800,
    `a placed photo: ${shot.width}×${shot.height} JPEG`,
  );
  // A mark the copy places (a cover logo) is still refused: it's the library's.
  const marks = await sql<{ image_id: string }[]>`select image_id from logos`;
  const withMark = await Promise.all(drafts.map(readContent));
  const at = withMark.findIndex((c) =>
    marks.some((m) => JSON.stringify(c).includes(m.image_id)),
  );
  ok(at >= 0, "a copy places a logo-library mark");
  const mark = marks.find((m) =>
    JSON.stringify(withMark[at]).includes(m.image_id),
  )!;
  ok(
    (await post(AI_PHOTO_PATH, { issueId: drafts[at], imageId: mark.image_id }))
      .status === 404,
    "a logo-library mark placed on the issue: 404",
  );
  const elsewhere = drafts
    .slice(1)
    .map(
      (_, i) =>
        JSON.stringify(seeds[i + 1]!.content).match(/"imageId":"([^"]+)"/)?.[1],
    )
    .find((other) => other && !JSON.stringify(saved).includes(other));
  if (elsewhere)
    ok(
      (await post(AI_PHOTO_PATH, { issueId: id, imageId: elsewhere }))
        .status === 404,
      "another issue's photo: 404",
    );
  ok(
    (await post(AI_PHOTO_PATH, { issueId: seed.id, imageId: placed }))
      .status === 409,
    "a published issue's photo: 409",
  );

  console.log("\nassistant render check: all checks passed");
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified) values
    (${adminId}, ${`${tag}-admin@example.invalid`}, true, false, now()),
    (${memberId}, ${`${tag}-member@example.invalid`}, false, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires) values
    (${adminToken}, ${adminId}, now() + interval '1 hour'),
    (${memberToken}, ${memberId}, now() + interval '1 hour')`;
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: adminToken,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await checks(await ctx.newPage());
} finally {
  await browser.close();
  if (drafts.length) {
    await sql`delete from ai_usage where issue_id in ${sql(drafts)}`;
    await sql`delete from issues where id in ${sql(drafts)}`;
  }
  await sql`delete from sessions where user_id in (${adminId}, ${memberId})`;
  await sql`delete from users where id in (${adminId}, ${memberId})`;
  await sql.end();
}
