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
  const { db } = await import("./index");
  const { issues, images } = await import("./schema");

  // Pre-mint an id per logical image so the content blocks can reference them.
  const imageIds = Object.fromEntries(
    SEED_ASSETS.map((a) => [a.key, id()]),
  ) as SeedImages;

  // Wipe (images first — they FK onto issues).
  await db.delete(images);
  await db.delete(issues);

  // Process + store each asset, then record it.
  const imageRows = [];
  for (const a of SEED_ASSETS) {
    const { key, width, height } = await processAndStore(a.file, a.key);
    imageRows.push({ id: imageIds[a.key], key, width, height, issueId: null });
  }
  await db.insert(images).values(imageRows);

  const rows = buildIssues(imageIds);
  await db.insert(issues).values(rows);

  console.log(
    `Seeded ${rows.length} published issues and ${imageRows.length} images.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
