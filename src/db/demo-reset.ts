// Return the demo site to a clean state: the six seed issues, with everything
// tested since — issues, comments, posting names, sponsors, logos, uploads,
// cached PDFs — gone. Members, their sessions and the magazine settings stay.
// Demo only: refuses unless NEXT_PUBLIC_DEMO_MODE=1, which the members' site
// never sets. Runbook: docs/demo-content.md.
//
// Run: npm run demo:reset  [-- --dry-run]  [-- --yes]
import { createInterface } from "node:readline/promises";
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  commentReports,
  comments,
  images,
  issueImports,
  issues,
  logos,
  memberNames,
  notifications,
  sponsors,
  users,
} from "./schema";
import { SEED_OBJECT_KEYS, seedIssues, type SeedDb } from "./seed-issues";
import {
  deleteSeedObjects,
  listSeedObjects,
  seedStorageTarget,
} from "./seed-storage";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

const CLEARED: [string, PgTable][] = [
  ["issues", issues],
  ["comments", comments],
  ["reports", commentReports],
  ["notifications", notifications],
  ["posting names", memberNames],
  ["sponsors", sponsors],
  ["logos", logos],
  ["images", images],
  ["import records", issueImports],
];

async function rowCount(db: SeedDb, table: PgTable): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table);
  return row?.n ?? 0;
}

// Stored objects no image row names, grouped by their first path segment.
function describeObjects(keys: string[]): string {
  const byPrefix = new Map<string, number>();
  for (const key of keys) {
    const prefix = key.includes("/") ? `${key.split("/")[0]}/` : key;
    byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
  }
  const parts = [...byPrefix].map(([prefix, n]) => `${prefix} ${n}`);
  return `${keys.length} object(s)${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

async function confirm(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new Error("No terminal to confirm on — pass --yes to reset anyway.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "reset" to continue: ');
  rl.close();
  return answer.trim() === "reset";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") {
    throw new Error(
      "Refusing to reset: NEXT_PUBLIC_DEMO_MODE is not 1. This only runs on the demo site, never the members' site.",
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const target = seedStorageTarget();
  const client = postgres(url, { max: 1 });
  const db = drizzle({ client });

  const { hostname, pathname } = new URL(url);
  console.log(`Database: ${hostname}${pathname}`);
  console.log(
    target === "r2"
      ? `Storage:  R2 bucket "${process.env.R2_BUCKET}"`
      : "Storage:  .data/uploads (R2 not configured)",
  );

  const counts = [];
  for (const [label, table] of CLEARED) {
    counts.push(`${await rowCount(db, table)} ${label}`);
  }
  console.log(`\nDeletes:  ${counts.join(", ")}.`);
  console.log(
    `Keeps:    ${await rowCount(db, users)} members, their sessions, the magazine settings.`,
  );
  console.log(
    "Then loads the six seed issues and deletes every stored object no image points to.",
  );

  if (dryRun) {
    const keep = new Set(SEED_OBJECT_KEYS);
    const stale = (await listSeedObjects()).filter((key) => !keep.has(key));
    console.log(`\nStorage would lose ${describeObjects(stale)}.`);
    console.log("Dry run — nothing changed.");
    await client.end();
    return;
  }

  if (!process.argv.includes("--yes") && !(await confirm())) {
    console.log("Cancelled — nothing changed.");
    await client.end();
    return;
  }

  // Everything the seed doesn't already replace. Issues cascade to comments,
  // reports and notifications; they are cleared here too so the step reads whole.
  const seeded = await seedIssues(db, async (tx) => {
    await tx.delete(notifications);
    await tx.delete(commentReports);
    await tx.delete(comments);
    await tx.delete(memberNames);
    await tx.delete(sponsors);
    await tx.delete(issueImports);
  });
  console.log(
    `\nSeeded ${seeded.issues} issues and ${seeded.images} generated images.`,
  );

  // Sweep after the commit. Listing before reading the rows means an object
  // stored after the listing is never swept.
  const stored = await listSeedObjects();
  const named = new Set(
    (await db.select({ key: images.key }).from(images)).map((row) => row.key),
  );
  const stale = stored.filter((key) => !named.has(key));
  await deleteSeedObjects(stale);
  console.log(`Deleted ${describeObjects(stale)} from storage.`);
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
