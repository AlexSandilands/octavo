// Seed the database with the six sample issues and their generated images
// (seed-issues.ts), replacing every issue, image and logo. To return the demo
// site to a clean state, members aside, use `npm run demo:reset` instead.
//
// Run: npm run db:seed  (after `docker compose up -d` and `npm run db:migrate`)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hasPublishedIssues, seedIssues } from "./seed-issues";
import { seedStorageTarget } from "./seed-storage";

// Load .env.local before anything reads process.env (all env reads are inside
// functions, so the hoisted imports don't beat this).
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

async function main() {
  // Resolve the storage backend first — it throws on a partial R2 config, and
  // saying where the bytes go up front is what makes a misconfigured demo
  // deploy (images seeded into the wrong place) impossible to miss.
  const target = seedStorageTarget();
  console.log(
    target === "r2"
      ? `Seed images → R2 bucket "${process.env.R2_BUCKET}".`
      : "Seed images → .data/uploads (local dev fallback; R2 not configured).",
  );

  // The app's db client lives behind src/lib/env.ts, which is `server-only`
  // and can't be imported outside Next. The seed builds its own client from
  // the same DATABASE_URL instead.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const client = postgres(url, { max: 1 });
  const db = drizzle({ client });

  // The seed WIPES all issues and images. Refuse anywhere that looks like real
  // data — production, or a database that already holds published issues —
  // unless explicitly forced.
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error(
      "Refusing to seed with NODE_ENV=production (it wipes all issues). Pass --force to override.",
    );
  }
  if (!force && (await hasPublishedIssues(db))) {
    throw new Error(
      "Refusing to seed: this database already holds published issues (it would wipe them). Pass --force to override.",
    );
  }

  const seeded = await seedIssues(db);
  console.log(
    `Seeded ${seeded.issues} published issues and ${seeded.images} generated images.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
