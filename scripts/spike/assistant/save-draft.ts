// `--save-draft`: writes a case's result into the LOCAL dev database as a new
// draft issue, so it can be opened in the real editor and judged by eye.
// Seed image ids (`img-<key>`) map to the rows `npm run db:seed` made
// (`seed/<key>.webp`). Anything else the issue uses (a case's generated photos
// and logo) is copied into the main checkout's .data/uploads/spike/ with its
// own `images` / `logos` rows; every file and row made is listed in the result
// dir's created.json so it can all be removed in one step.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { collectImageIds } from "../../../src/lib/images.ts";
import { createId } from "../../../src/lib/id.ts";
import { MAIN_CHECKOUT, type IssueContext } from "./seed.ts";

function databaseUrl(): string {
  for (const file of [".env.local", join(MAIN_CHECKOUT, ".env.local")])
    try {
      process.loadEnvFile?.(file);
    } catch {
      // not there — fine
    }
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is not set (needed for --save-draft)");
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(
      `--save-draft only writes to a local database, not ${host}`,
    );
  return url;
}

type Created = {
  issueId: string;
  images: { id: string; key: string; file: string }[];
  logos: string[];
};

export async function saveDraft(
  ctx: IssueContext,
  title: string,
  resultDir: string,
): Promise<string> {
  const sql = postgres(databaseUrl(), { max: 1 });
  const issueId = createId();
  const created: Created = { issueId, images: [], logos: [] };
  try {
    const rows = await sql<
      { id: string; key: string }[]
    >`select id, key from images where key like 'seed/%'`;
    const ids = new Map(
      rows.map((r) => [`img-${r.key.replace(/^seed\/|\.webp$/g, "")}`, r.id]),
    );
    await sql.begin(async (tx) => {
      await tx`insert into issues (id, title, theme, status, content) values (${issueId}, ${title}, ${ctx.theme}, 'draft', ${sql.json({ version: 1, pages: [] })})`;
      // Uploads the seed doesn't have: copy the bytes, add an images row.
      const needed = new Set([
        ...collectImageIds(ctx.content),
        ...ctx.uploads.map((u) => u.id),
        ...ctx.logos.map((l) => l.imageId),
      ]);
      for (const spikeId of needed) {
        const info = ctx.images.get(spikeId);
        if (ids.has(spikeId) || !info?.file) continue;
        const id = createId();
        const key = `spike/${issueId}/${spikeId}.webp`;
        const file = join(MAIN_CHECKOUT, ".data/uploads", key);
        mkdirSync(dirname(file), { recursive: true });
        copyFileSync(info.file, file);
        await tx`insert into images (id, key, width, height, issue_id) values (${id}, ${key}, ${info.width}, ${info.height}, ${issueId})`;
        ids.set(spikeId, id);
        created.images.push({ id, key, file });
      }
      for (const logo of ctx.logos) {
        if (logo.id.startsWith("seed-")) continue;
        const id = createId();
        await tx`insert into logos (id, name, image_id) values (${id}, ${logo.name}, ${ids.get(logo.imageId)!})`;
        ids.set(logo.id, id);
        created.logos.push(id);
      }
      const json = JSON.stringify(ctx.content).replace(
        /"((?:img|logo)-[\w-]+)"/g,
        (m, key: string) => (ids.has(key) ? `"${ids.get(key)}"` : m),
      );
      await tx`update issues set content = ${sql.json(JSON.parse(json))} where id = ${issueId}`;
    });
    writeFileSync(
      join(resultDir, "created.json"),
      JSON.stringify(created, null, 2),
    );
    return issueId;
  } finally {
    await sql.end();
  }
}
