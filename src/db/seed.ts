// Seed the database with ten issues of threaded pétanque content (see
// seed-data.ts) and the images they reference, processed from /assets the same
// way the editor processes uploads (WebP, longest edge ≤ 2000px) and written to
// the local-disk storage backend the reader serves from.
//
// Run: npm run db:seed  (after `docker compose up -d` and `npm run db:migrate`)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildIssues, SEED_ASSETS, type SeedImages } from "./seed-data";

// Load .env.local before importing modules that read process.env.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

const id = () => crypto.randomUUID();
const UPLOAD_ROOT = path.join(process.cwd(), ".data", "uploads");

// Mirror src/lib/image-processing.ts (can't import it: it pulls in `server-only`,
// which throws outside a React Server environment). WebP, EXIF-rotated, capped.
async function processAndStore(file: string, name: string) {
  const input = await readFile(path.join(process.cwd(), "assets", file));
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  // Same key shape the app uses; served at /api/images/<key> in local mode.
  const key = `seed/${name}.webp`;
  const dest = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, data);
  return { key, width: info.width, height: info.height };
}

async function main() {
  // The app's db client lives behind src/lib/env.ts, which is `server-only`
  // and can't be imported outside Next. The seed builds its own client from
  // the same DATABASE_URL instead.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const { eq } = await import("drizzle-orm");
  const { issues, images } = await import("./schema");
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
  if (!force) {
    const [published] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.status, "published"))
      .limit(1);
    if (published) {
      throw new Error(
        "Refusing to seed: this database already holds published issues (it would wipe them). Pass --force to override.",
      );
    }
  }

  // Pre-mint an id per logical image so the content blocks can reference them.
  const imageIds = Object.fromEntries(
    SEED_ASSETS.map((a) => [a.key, id()]),
  ) as SeedImages;

  // Process + store each asset up front (filesystem work stays outside the
  // transaction), then wipe + insert atomically so a crash can't leave a
  // half-empty database.
  const imageRows: {
    id: string;
    key: string;
    width: number;
    height: number;
    issueId: string | null;
  }[] = [];
  for (const a of SEED_ASSETS) {
    const { key, width, height } = await processAndStore(a.file, a.key);
    imageRows.push({ id: imageIds[a.key], key, width, height, issueId: null });
  }
  const rows = buildIssues(imageIds);

  await db.transaction(async (tx) => {
    // Wipe (images first — they FK onto issues).
    await tx.delete(images);
    await tx.delete(issues);
    await tx.insert(images).values(imageRows);
    await tx.insert(issues).values(rows);
  });

  console.log(
    `Seeded ${rows.length} published issues and ${imageRows.length} images.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
