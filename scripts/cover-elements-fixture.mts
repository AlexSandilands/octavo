import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile, rm } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import sharp from "sharp";
import type { IssueContent } from "../src/lib/blocks";

/** A local scratch issue and logo; shared seed images are only read. */
export async function withCoverFixture(
  base: string,
  check: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>,
) {
  assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  for (const env of [".env", ".env.local"])
    if (existsSync(env)) process.loadEnvFile(env);
  const fixture = await createFixture(base);
  try {
    await check(fixture);
  } finally {
    await fixture.browser.close();
    await fixture.sql`delete from issues where id=${fixture.id}`;
    await fixture.sql`delete from logos where id=${fixture.logoId}`;
    await fixture.sql`delete from images where id=${fixture.imageId}`;
    await fixture.sql`delete from users where id=${fixture.userId}`;
    await fixture.sql.end();
    await rm(fixture.path, { force: true });
  }
}
async function createFixture(base: string) {
  const sql = postgres(process.env.DATABASE_URL!);
  const id = crypto.randomUUID(),
    userId = crypto.randomUUID(),
    token = crypto.randomUUID(),
    imageId = crypto.randomUUID(),
    logoId = crypto.randomUUID();
  const key = `cover-check-${id}.webp`,
    path = `.data/uploads/${key}`;
  const [photo] = await sql<
    { id: string }[]
  >`select id from images where key like 'seed/%' order by key limit 1`;
  assert(photo, "local seed image required");
  const art = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" rx="4" fill="#faf7f0"/><rect x="4" y="4" width="232" height="112" rx="2" fill="none" stroke="#1d4d3e" stroke-width="2"/><circle cx="80" cy="60" r="26" fill="none" stroke="#1d4d3e" stroke-width="4"/><path d="M125 32h60v8h-60zm0 24h45v8h-45zm0 24h60v8h-60z" fill="#1d4d3e"/></svg>',
    ),
  )
    .webp()
    .toBuffer();
  await writeFile(path, art);
  await sql`insert into images (id,key,width,height) values (${imageId},${key},240,120)`;
  await sql`insert into logos (id,name,image_id) values (${logoId},'Cover test mark',${imageId})`;
  const content: IssueContent = {
    version: 6,
    pages: [
      {
        id: "cover",
        cover: true,
        blocks: [
          {
            id: "masthead",
            type: "heading",
            title: "Field Notes",
            kicker: "The Members’ Magazine",
          },
          {
            id: "photo",
            type: "image",
            imageId: photo.id,
            align: "page-fill",
            width: 100,
            caption: "",
          },
        ],
      },
      {
        id: "page-two",
        blocks: [
          {
            id: "history",
            type: "heading",
            title: "Our earliest days",
            kicker: "History",
          },
          {
            id: "history-text",
            type: "text",
            text: "Stories from the club archive.",
          },
        ],
      },
      {
        id: "page-three",
        blocks: [
          {
            id: "tactics",
            type: "heading",
            title: "A better game",
            kicker: "Tactics",
          },
          {
            id: "community",
            type: "heading",
            title: "Meet the members",
            kicker: "Community",
            level: "section",
          },
        ],
      },
    ],
  };
  await sql`insert into users (id,email,is_admin,subscribed,email_verified) values (${userId},${`cover-elements-${userId}@example.invalid`},true,false,now())`;
  await sql`insert into sessions (session_token,user_id,expires) values (${token},${userId},now()+interval '1 hour')`;
  const [issue] = await sql<
    { number: number }[]
  >`insert into issues (id,number,title,theme,status,content) values (${id},(select coalesce(max(number),0)+1 from issues),'Cover element check','classic','draft',${sql.json(content)}) returning number`;
  assert(issue);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const edit = `${base}/admin/issues/${id}/edit`;
  const stored = async () => {
    const [row] = await sql<
      { content: IssueContent }[]
    >`select content from issues where id=${id}`;
    assert(row);
    return row.content;
  };
  const waitSaved = async (predicate: (content: IssueContent) => boolean) => {
    for (let i = 0; i < 100; i++) {
      if (predicate(await stored())) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Expected content was not autosaved");
  };
  return {
    sql,
    id,
    userId,
    imageId,
    logoId,
    path,
    browser,
    context,
    page,
    errors,
    edit,
    stored,
    waitSaved,
    number: issue.number,
  };
}
export type CoverFixture = Awaited<ReturnType<typeof createFixture>>;
