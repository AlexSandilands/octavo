// Shared set-up for the discussion checks (issue #299): the session stub, the
// app modules loaded behind it, and scratch rows that are all removed again.
// The settings row is snapshotted and restored exactly, whatever it held.
import { existsSync } from "node:fs";
import { register } from "node:module";
import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
register("./session-hooks.mjs", import.meta.url);

// Loaded after the hook is in place, so their session import is the stub.
export const { actAs } = await import("./session-stub.mts");
export const { db } = await import("../../../src/db/index.ts");
export const schema = await import("../../../src/db/schema.ts");
export const names = await import("../../../src/server/member-names.ts");
export const thread = await import("../../../src/server/comments.ts");
export const moderation =
  await import("../../../src/server/comment-moderation.ts");
export const notices = await import("../../../src/server/notifications.ts");
export const removal = await import("../../../src/server/member-removal.ts");
export const assets = await import("../../../src/server/asset-cleanup.ts");
export const storage = await import("../../../src/lib/storage.ts");
const { emptyIssueContent } = await import("../../../src/lib/blocks.ts");

const { users, issues, images, settings } = schema;

let failures = 0;
export const ok = (cond: unknown, msg: string) => {
  if (cond) {
    console.log(`ok — ${msg}`);
  } else {
    failures++;
    console.log(`FAIL — ${msg}`);
  }
};
export const heading = (name: string) =>
  console.log(`\n── ${name} `.padEnd(72, "─"));

const created = { users: [] as string[], issues: [] as string[] };
const tag = randomUUID().slice(0, 8);

export type Scratch = { id: string; email: string; isAdmin: boolean };

export async function scratchUser(
  opts: { name?: string | null; isAdmin?: boolean } = {},
): Promise<Scratch> {
  const email = `check-299-${tag}-${created.users.length}@example.invalid`;
  const [row] = await db
    .insert(users)
    .values({
      email,
      name: opts.name ?? null,
      isAdmin: opts.isAdmin ?? false,
    })
    .returning({ id: users.id });
  created.users.push(row!.id);
  return { id: row!.id, email, isAdmin: opts.isAdmin ?? false };
}

export function as(user: Scratch | null) {
  actAs(user ? { ...user, name: null } : null);
}

export async function scratchIssue(published = true) {
  const [max] = await db
    .select({ n: sql<number>`coalesce(max(${issues.number}), 0)` })
    .from(issues);
  const content = emptyIssueContent();
  const [row] = await db
    .insert(issues)
    .values({
      title: `check-299 ${tag}`,
      content,
      status: published ? "published" : "draft",
      number: published ? Number(max!.n) + 5000 + created.issues.length : null,
      publishedAt: published ? new Date() : null,
    })
    .returning({ id: issues.id });
  created.issues.push(row!.id);
  return { id: row!.id, pageIds: content.pages.map((p) => p.id) };
}

// A stored image with no issue, as an avatar upload will be (#300).
export async function scratchImage() {
  const key = `check-299/${tag}/${randomUUID()}.webp`;
  await storage.putObject(key, Buffer.from("avatar"), "image/webp");
  const [row] = await db
    .insert(images)
    .values({ key, width: 1, height: 1, issueId: null })
    .returning({ id: images.id });
  return { id: row!.id, key };
}

export async function objectExists(key: string) {
  return (await storage.getObject(key)) !== null;
}

// The settings row as found, restored at the end — including "no row at all".
const [original] = await db.select().from(settings);

export async function setSettings(values: {
  commentsEnabled?: boolean | null;
  removedMemberComments?: "delete" | "anonymise" | null;
}) {
  await db
    .insert(settings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values });
}

export async function withoutSettingsRow<T>(fn: () => Promise<T>) {
  await db.delete(settings);
  try {
    return await fn();
  } finally {
    await restoreSettings();
  }
}

async function restoreSettings() {
  await db.delete(settings);
  if (original) await db.insert(settings).values(original);
}

export async function finish() {
  actAs(null);
  // Issues first (their threads cascade), then users (names cascade), then any
  // image rows and objects the checks left.
  if (created.issues.length) {
    await db.delete(issues).where(inArray(issues.id, created.issues));
  }
  if (created.users.length) {
    await db.delete(users).where(inArray(users.id, created.users));
  }
  const leftovers = await db
    .delete(images)
    .where(sql`${images.key} like ${`check-299/${tag}/%`}`)
    .returning({ key: images.key });
  for (const { key } of leftovers) await storage.deleteObject(key);
  await restoreSettings();
  const [after] = await db.select().from(settings);
  const same =
    JSON.stringify(after ?? null) === JSON.stringify(original ?? null);
  console.log(`\nsettings row restored as found: ${same ? "yes" : "NO"}`);
  if (!same) failures++;
  console.log(failures === 0 ? "all checks passed" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
