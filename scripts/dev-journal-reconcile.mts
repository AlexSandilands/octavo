// Dev-only: reconciles a local database's drizzle bookkeeping table with the
// migrations committed in `drizzle/` (issue #164).
//
// `npm run db:push` writes schema changes straight into the DB without telling
// drizzle's journal about them. If the matching migration is generated and
// committed afterwards, the local DB ends up carrying that migration's effects
// with no journal row to say so — and the next `npm run db:migrate` re-runs it
// and dies on "column already exists". The committed migrations are fine; only
// the local bookkeeping is behind. This script inserts the missing rows.
//
// It is strictly additive: it never runs migration SQL, never deletes and never
// updates an existing journal row. A migration is journaled only when the live
// catalogue proves its effects are already there — so on a database that really
// hasn't run it, this script does nothing and leaves the work to `db:migrate`.
//
// Run: npx tsx scripts/dev-journal-reconcile.mts [--dry-run] [--allow-remote]
import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowRemote = args.has("--allow-remote");
for (const arg of args) {
  if (arg !== "--dry-run" && arg !== "--allow-remote") {
    throw new Error(
      `unknown option ${arg} — usage: dev-journal-reconcile.mts [--dry-run] [--allow-remote]`,
    );
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (expected in .env.local)");

// This drift is a local-iteration artefact, and journal rows are the one thing
// standing between a deploy and a re-applied migration. Refuse to touch anything
// that isn't obviously a dev database unless the caller insists.
const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", ""].includes(host);
if (!isLocal && !allowRemote) {
  throw new Error(
    `DATABASE_URL points at ${host}, which is not a local database. ` +
      `This script is for dev drift; re-run with --allow-remote if you are sure.`,
  );
}

// Mirrors drizzle-orm's own migrator (node_modules/drizzle-orm/migrator.js +
// migrator.utils.js), because the rows we insert have to be byte-identical to
// the ones `db:migrate` would have written:
//   name        the migration folder's name — the ONLY field drizzle compares
//               when deciding what to run (getMigrationsToRun diffs name sets)
//   hash        sha256 of the whole migration.sql, hex
//   created_at  Date.UTC() of the folder's 14-digit yyyymmddhhmmss prefix
// Verified against the five rows this database already had: all five matched.
const MIGRATIONS_DIR = "drizzle";
const BREAKPOINT = "--> statement-breakpoint";

type LocalMigration = {
  name: string;
  hash: string;
  folderMillis: number;
  statements: string[];
};

function folderMillis(name: string): number {
  const d = name.slice(0, 14);
  return Date.UTC(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)) - 1,
    Number(d.slice(6, 8)),
    Number(d.slice(8, 10)),
    Number(d.slice(10, 12)),
    Number(d.slice(12, 14)),
  );
}

function readLocalMigrations(): LocalMigration[] {
  return readdirSync(MIGRATIONS_DIR)
    .map((name) => ({
      name,
      path: join(MIGRATIONS_DIR, name, "migration.sql"),
    }))
    .filter((it) => existsSync(it.path))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, path }) => {
      const sqlText = readFileSync(path).toString();
      return {
        name,
        hash: crypto.createHash("sha256").update(sqlText).digest("hex"),
        folderMillis: folderMillis(name),
        statements: sqlText
          .split(BREAKPOINT)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    });
}

// What a statement leaves behind in the catalogue, if anything. `data` is a row
// write (the backfill in add-issue-footer-reserve, say): it leaves no schema
// trace, so it can neither prove nor disprove that the migration ran. `unknown`
// is a shape this checker doesn't understand — which means we can't prove the
// migration ran, so we won't journal it.
type Effect = { label: string; present: () => Promise<boolean> };
type Statement =
  | { kind: "effect"; effect: Effect }
  | { kind: "data" }
  | { kind: "unknown"; text: string };

const sql = postgres(url, { max: 1 });

// All of the app's objects live in `public` (the schema.ts tables are
// unqualified); `drizzle` holds only the bookkeeping table.
const exists = {
  table: (name: string) => async () =>
    (
      await sql`select 1 from information_schema.tables
                where table_schema = 'public' and table_name = ${name}`
    ).length > 0,
  column: (table: string, column: string) => async () =>
    (
      await sql`select 1 from information_schema.columns
                where table_schema = 'public'
                  and table_name = ${table} and column_name = ${column}`
    ).length > 0,
  index: (name: string) => async () =>
    (
      await sql`select 1 from pg_indexes
                where schemaname = 'public' and indexname = ${name}`
    ).length > 0,
  type: (name: string) => async () =>
    (
      await sql`select 1 from pg_type t
                join pg_namespace n on n.oid = t.typnamespace
                where n.nspname = 'public' and t.typname = ${name}`
    ).length > 0,
  constraint: (table: string, name: string) => async () =>
    (
      await sql`select 1 from pg_constraint c
                join pg_class r on r.oid = c.conrelid
                join pg_namespace n on n.oid = r.relnamespace
                where n.nspname = 'public'
                  and r.relname = ${table} and c.conname = ${name}`
    ).length > 0,
};

// Quoted identifiers only — that is all drizzle-kit generates, and matching
// loosely would risk claiming a migration ran when it didn't.
const ID = `"([^"]+)"`;
const PATTERNS: {
  re: RegExp;
  effect: (m: RegExpMatchArray) => Effect;
}[] = [
  {
    re: new RegExp(`^CREATE\\s+TYPE\\s+${ID}`, "i"),
    effect: (m) => ({ label: `type ${m[1]}`, present: exists.type(m[1]!) }),
  },
  {
    re: new RegExp(
      `^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${ID}`,
      "i",
    ),
    effect: (m) => ({ label: `table ${m[1]}`, present: exists.table(m[1]!) }),
  },
  {
    re: new RegExp(
      `^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${ID}`,
      "i",
    ),
    effect: (m) => ({ label: `index ${m[1]}`, present: exists.index(m[1]!) }),
  },
  {
    re: new RegExp(
      `^ALTER\\s+TABLE\\s+${ID}\\s+ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${ID}`,
      "i",
    ),
    effect: (m) => ({
      label: `column ${m[1]}.${m[2]}`,
      present: exists.column(m[1]!, m[2]!),
    }),
  },
  {
    re: new RegExp(
      `^ALTER\\s+TABLE\\s+${ID}\\s+ADD\\s+CONSTRAINT\\s+${ID}`,
      "i",
    ),
    effect: (m) => ({
      label: `constraint ${m[1]}.${m[2]}`,
      present: exists.constraint(m[1]!, m[2]!),
    }),
  },
];

function classify(statement: string): Statement {
  // Drop leading line comments so the opening keyword is the first thing left —
  // generated migrations carry hand-written notes above the SQL.
  const text = statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  if (!text) return { kind: "data" };
  for (const { re, effect } of PATTERNS) {
    const m = text.match(re);
    if (m) return { kind: "effect", effect: effect(m) };
  }
  if (/^(INSERT|UPDATE|DELETE)\b/i.test(text)) return { kind: "data" };
  return { kind: "unknown", text: text.split("\n")[0]!.slice(0, 90) };
}

type Verdict =
  | { applied: true; effects: string[] }
  | { applied: false; reason: string };

async function inspect(migration: LocalMigration): Promise<Verdict> {
  const classified = migration.statements.map(classify);

  const unknown = classified.filter((s) => s.kind === "unknown");
  if (unknown.length > 0) {
    return {
      applied: false,
      reason: `contains ${unknown.length} statement(s) this check can't read, e.g. "${unknown[0]!.text}" — can't prove it ran`,
    };
  }

  const effects = classified.flatMap((s) =>
    s.kind === "effect" ? [s.effect] : [],
  );
  if (effects.length === 0) {
    return {
      applied: false,
      reason:
        "changes no schema objects, so there is nothing to prove it ran by",
    };
  }

  const missing: string[] = [];
  const found: string[] = [];
  for (const effect of effects) {
    if (await effect.present()) found.push(effect.label);
    else missing.push(effect.label);
  }
  if (missing.length > 0) {
    return {
      applied: false,
      // Partly applied is the dangerous case: neither `db:migrate` nor this
      // script can finish it, so say exactly what is missing and stop.
      reason:
        found.length === 0
          ? `not applied here (missing ${missing.join(", ")}) — run npm run db:migrate`
          : `PARTIALLY applied — has ${found.join(", ")} but is missing ${missing.join(", ")}; needs a human`,
    };
  }
  return { applied: true, effects: found };
}

const local = readLocalMigrations();
const journal = await sql<
  { id: number; hash: string; created_at: string; name: string | null }[]
>`select id, hash, created_at, name
  from drizzle.__drizzle_migrations
  order by id`;

console.log(
  `${local.length} migration(s) in ${MIGRATIONS_DIR}/, ${journal.length} row(s) in drizzle.__drizzle_migrations`,
);

const journaled = new Map(journal.map((r) => [r.name, r]));

// Read-only sanity notes. A hash that no longer matches means someone edited a
// migration after it was applied — this script won't rewrite the row (deploys
// don't re-read hashes either), but you want to know.
for (const migration of local) {
  const row = journaled.get(migration.name);
  if (row && row.hash !== migration.hash) {
    console.warn(
      `warn — ${migration.name} is journaled with a different hash; migration.sql changed after it was applied`,
    );
  }
}
for (const row of journal) {
  if (row.name && !local.some((m) => m.name === row.name)) {
    console.warn(
      `warn — journal row #${row.id} "${row.name}" has no folder in ${MIGRATIONS_DIR}/; this DB is ahead of the checkout`,
    );
  }
}

const unjournaled = local.filter((m) => !journaled.has(m.name));
if (unjournaled.length === 0) {
  console.log("nothing to do — every committed migration is journaled");
  await sql.end();
  process.exit(0);
}

const toInsert: LocalMigration[] = [];
let blocked = 0;
for (const migration of unjournaled) {
  const verdict = await inspect(migration);
  if (verdict.applied) {
    console.log(
      `applied-but-unjournaled — ${migration.name} (found ${verdict.effects.join(", ")})`,
    );
    toInsert.push(migration);
  } else {
    blocked += 1;
    console.log(`leaving alone — ${migration.name}: ${verdict.reason}`);
  }
}

if (toInsert.length > 0 && !dryRun) {
  // Chronological, so the SERIAL ids stay in migration order. Drizzle only ever
  // compares names, but a journal that reads in order is worth the one sort.
  //
  // applied_at is left NULL deliberately: we don't know when db:push made these
  // changes, and NULL is what drizzle's own back-fill (up-migrations/pg.ts) puts
  // there for rows it reconstructs rather than writes at apply time.
  const ordered = [...toInsert].sort((a, b) => a.folderMillis - b.folderMillis);
  await sql.begin(async (tx) => {
    for (const m of ordered) {
      await tx`insert into drizzle.__drizzle_migrations (hash, created_at, name, applied_at)
               values (${m.hash}, ${m.folderMillis}, ${m.name}, null)`;
    }
  });
}

console.log(
  dryRun
    ? `\ndry run — would insert ${toInsert.length} journal row(s)`
    : `\ninserted ${toInsert.length} journal row(s); npm run db:migrate should now be a no-op`,
);

await sql.end();
// A blocked migration is real drift that this script can't settle — fail so it
// isn't mistaken for a clean run.
if (blocked > 0) process.exit(1);
