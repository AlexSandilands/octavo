// Seed the database with six sample issues — visibly distinct magazine
// archetypes across both layout themes (see seed-data.ts) — and the images they
// reference. Every image is generated placeholder art (seed/art.ts): SVG
// rasterized with sharp through the same pipeline the editor applies to uploads
// (WebP, longest edge ≤ 2000px), then stored where the app's storage facade
// would store it — Cloudflare R2 when configured, local disk otherwise (see
// seed-storage.ts) — so the reader serves the seeded issues on any machine and
// any deploy, with no repo binaries and no cloud required.
//
// Run: npm run db:seed  (after `docker compose up -d` and `npm run db:migrate`)
import sharp from "sharp";
import { buildIssues } from "./seed-data";
import { renderArtSvg, type SeedArtSpec } from "./seed/art";
import { SEED_IMAGES, type SeedImages } from "./seed/images";
import { putSeedObject, seedStorageTarget } from "./seed-storage";

// Load .env.local before anything reads process.env (all env reads below are
// inside functions, so the hoisted imports don't beat this).
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

const id = () => crypto.randomUUID();

// Mirror src/lib/image-processing.ts (can't import it: it pulls in
// `server-only`, which throws outside a React Server environment). WebP,
// EXIF-rotated, capped — identical treatment to an editor upload, so the
// recorded width/height always match the stored bytes.
async function processAndStore(spec: SeedArtSpec) {
  const svg = Buffer.from(renderArtSvg(spec));
  const { data, info } = await sharp(svg, { failOn: "error" })
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  // Same key shape the app uses; served at the R2 public URL when R2 is
  // configured, at /api/images/<key> in local mode.
  const key = `seed/${spec.key}.webp`;
  await putSeedObject(key, data, "image/webp");
  return { key, width: info.width, height: info.height };
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
    SEED_IMAGES.map((spec) => [spec.key, id()]),
  ) as SeedImages;

  // Generate + store each image up front (storage work stays outside the
  // transaction), then wipe + insert atomically so a crash can't leave a
  // half-empty database.
  const imageRows: {
    id: string;
    key: string;
    width: number;
    height: number;
    issueId: string | null;
  }[] = [];
  for (const spec of SEED_IMAGES) {
    const { key, width, height } = await processAndStore(spec);
    imageRows.push({
      id: imageIds[spec.key],
      key,
      width,
      height,
      issueId: null,
    });
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
    `Seeded ${rows.length} published issues and ${imageRows.length} generated images.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
