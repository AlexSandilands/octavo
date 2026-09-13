// Dev-only: checks that `isUniqueViolation` (src/lib/db-errors.ts) recognises a
// real SQLSTATE 23505 as drizzle throws it — wrapped, with the driver error on
// `.cause` — so `publishIssue` can answer a taken issue number with a conflict
// instead of a 500 (issues #271, #270).
// Needs DATABASE_URL; its writes roll back, leaving no rows behind.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-unique-violation.mts
import { existsSync } from "node:fs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { issues } from "../src/db/schema.ts";
import { emptyIssueContent } from "../src/lib/blocks.ts";
import { isUniqueViolation } from "../src/lib/db-errors.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// The check the fix replaced: top-level `code` only. Kept here to show the
// wrapped error really did slip past it.
const topLevelOnly = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: unknown }).code === "23505";

console.log("\n— hand-built errors —");
ok(
  isUniqueViolation(
    new DrizzleQueryError("insert …", [], {
      code: "23505",
    } as unknown as Error),
  ),
  "DrizzleQueryError with cause.code 23505 → true",
);
ok(
  isUniqueViolation(
    Object.assign(new Error("duplicate key"), { code: "23505" }),
  ),
  "bare driver error with code 23505 → true",
);
ok(
  isUniqueViolation(
    new Error("a", {
      cause: new Error("b", {
        cause: Object.assign(new Error("c"), { code: "23505" }),
      }),
    }),
  ),
  "23505 two levels down the cause chain → true",
);
ok(
  !isUniqueViolation(
    new DrizzleQueryError(
      "insert …",
      [],
      Object.assign(new Error("fk"), { code: "23503" }),
    ),
  ),
  "foreign-key violation (23503) → false",
);
ok(!isUniqueViolation(new Error("plain")), "unrelated error → false");
ok(
  !isUniqueViolation(undefined) && !isUniqueViolation(null),
  "nullish → false",
);

console.log("\n— a real violation through drizzle —");
class Rollback extends Error {}

// A published row at a fixed number — the only shape the number is unique in
// (the partial unique index over published rows, issue #270).
const insertPublished = (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  number: number,
) =>
  tx.insert(issues).values({
    number,
    title: "issue #271 check (rolled back)",
    theme: "classic",
    status: "published",
    publishedAt: new Date(),
    content: emptyIssueContent(),
  });

const [maxRow] = await db
  .select({ max: sql<number | null>`coalesce(max(${issues.number}), 0)` })
  .from(issues);
const taken = (maxRow?.max ?? 0) + 1000;
const fresh = taken + 1;

let caught: unknown;
let attempts = 0;
let landedOn: number | null = null;

try {
  await db.transaction(async (tx) => {
    await insertPublished(tx, taken); // the number another publish won
    // One savepoint per attempt, so the refused write doesn't abort the
    // transaction the free number still has to land in.
    for (const number of [taken, fresh]) {
      attempts++;
      try {
        await tx.transaction(async (sp) => {
          await insertPublished(sp, number);
        });
        landedOn = number;
        break;
      } catch (err) {
        caught = err;
        if (attempts >= 2 || !isUniqueViolation(err)) throw err;
      }
    }
    throw new Rollback();
  });
} catch (err) {
  if (!(err instanceof Rollback)) throw err;
}

ok(caught instanceof Error, `the collision threw ${caught?.constructor.name}`);
ok(
  !topLevelOnly(caught),
  "the old top-level `code` check missed it (the bug in #271)",
);
ok(isUniqueViolation(caught), "isUniqueViolation recognises it → true");
ok(
  attempts === 2,
  `the taken number was refused and a second attempt made (attempts: ${attempts})`,
);
ok(landedOn === fresh, `a free number still lands (No. ${landedOn})`);

const leftovers = await db
  .select({ number: issues.number })
  .from(issues)
  .where(inArray(issues.number, [taken, fresh]));
ok(leftovers.length === 0, "the transaction rolled back — no rows left behind");

console.log("\nall checks passed");
process.exit(0);
