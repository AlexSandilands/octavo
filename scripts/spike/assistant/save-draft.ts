// `--save-draft`: writes a case's result into the LOCAL dev database as a new
// draft issue, so it can be opened in the real editor and judged by eye.
// Seed image ids (`img-<key>`) map to the rows `npm run db:seed` made
// (`seed/<key>.webp`). Anything else the issue uses (a case's generated or real
// photos and logo) keeps its id as the row id, copied into the main checkout's
// .data/uploads/spike/; a row already holding that id and the same bytes is
// reused. Every file and row made or reused is listed in the result dir's
// created.json so it can all be removed in one step.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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
  /** `reused`: a row with this id and identical bytes was already there. */
  images: { id: string; key: string; file: string; reused: boolean }[];
  logos: { id: string; reused: boolean }[];
};

const sha = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

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
    // Content id → row id. Seed images map to the seed's rows; everything else
    // keeps the id the content already uses, unless that id is taken by
    // different bytes (then a fresh id, rewritten into the content).
    const ids = new Map(
      rows.map((r) => [`img-${r.key.replace(/^seed\/|\.webp$/g, "")}`, r.id]),
    );
    await sql.begin(async (tx) => {
      await tx`insert into issues (id, title, theme, status, content) values (${issueId}, ${title}, ${ctx.theme}, 'draft', ${sql.json({ version: 1, pages: [] })})`;
      // Uploads the seed doesn't have: copy the bytes, add (or reuse) a row.
      const needed = new Set([
        ...collectImageIds(ctx.content),
        ...ctx.uploads.map((u) => u.id),
        ...ctx.logos.map((l) => l.imageId),
      ]);
      for (const spikeId of needed) {
        const info = ctx.images.get(spikeId);
        if (ids.has(spikeId) || !info?.file) continue;
        const [existing] = await tx<
          { key: string }[]
        >`select key from images where id = ${spikeId}`;
        if (existing) {
          const file = join(MAIN_CHECKOUT, ".data/uploads", existing.key);
          if (existsSync(file) && sha(file) === sha(info.file)) {
            ids.set(spikeId, spikeId);
            created.images.push({
              id: spikeId,
              key: existing.key,
              file,
              reused: true,
            });
            continue;
          }
        }
        const id = existing ? createId() : spikeId;
        const key = `spike/${issueId}/${id}.webp`;
        const file = join(MAIN_CHECKOUT, ".data/uploads", key);
        mkdirSync(dirname(file), { recursive: true });
        copyFileSync(info.file, file);
        await tx`insert into images (id, key, width, height, issue_id) values (${id}, ${key}, ${info.width}, ${info.height}, ${issueId})`;
        ids.set(spikeId, id);
        created.images.push({ id, key, file, reused: false });
      }
      for (const logo of ctx.logos) {
        if (logo.id.startsWith("seed-")) continue;
        const imageId = ids.get(logo.imageId)!;
        const [existing] = await tx<
          { name: string; image_id: string }[]
        >`select name, image_id from logos where id = ${logo.id}`;
        if (existing?.name === logo.name && existing.image_id === imageId) {
          ids.set(logo.id, logo.id);
          created.logos.push({ id: logo.id, reused: true });
          continue;
        }
        const id = existing ? createId() : logo.id;
        await tx`insert into logos (id, name, image_id) values (${id}, ${logo.name}, ${imageId})`;
        ids.set(logo.id, id);
        created.logos.push({ id, reused: false });
      }
      // Rewrite every string that is a mapped id; anything else is untouched.
      const content: unknown = JSON.parse(
        JSON.stringify(ctx.content),
        (_, v) => (typeof v === "string" && ids.has(v) ? ids.get(v) : v),
      );
      await tx`update issues set content = ${sql.json(content as never)} where id = ${issueId}`;
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
