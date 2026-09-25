// `--save-draft`: writes a case's result into the LOCAL dev database as a new
// draft issue, so it can be opened in the real editor and judged by eye. Seed
// image ids (`img-<key>`) are mapped to the rows `npm run db:seed` made
// (`seed/<key>.webp`); ids with no row (a case's made-up uploads) are left and
// render as the empty photo placeholder.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { createId } from "../../../src/lib/id.ts";
import type { IssueContext } from "./seed.ts";

function databaseUrl(): string {
  // This checkout's .env.local, else the main checkout's (worktrees have none).
  const common = execSync(
    "git rev-parse --path-format=absolute --git-common-dir",
  )
    .toString()
    .trim();
  for (const file of [".env.local", join(dirname(common), ".env.local")])
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

export async function saveDraft(
  ctx: IssueContext,
  title: string,
): Promise<string> {
  const sql = postgres(databaseUrl(), { max: 1 });
  try {
    const rows = await sql<
      { id: string; key: string }[]
    >`select id, key from images where key like 'seed/%'`;
    const byKey = new Map(
      rows.map((r) => [r.key.replace(/^seed\/|\.webp$/g, ""), r.id]),
    );
    const json = JSON.stringify(ctx.content).replace(
      /"img-([\w-]+)"/g,
      (m, key: string) => (byKey.has(key) ? `"${byKey.get(key)}"` : m),
    );
    const id = createId();
    await sql`insert into issues (id, title, theme, status, content) values (${id}, ${title}, ${ctx.theme}, 'draft', ${sql.json(JSON.parse(json))})`;
    return id;
  } finally {
    await sql.end();
  }
}
