// Load the six sample issues — visibly distinct magazine archetypes across both
// layout themes (see seed-data.ts) — and the images they reference, replacing
// every issue, image and logo. Shared by `npm run db:seed` and
// `npm run demo:reset`, which clears more inside the same transaction.
//
// Every image is generated placeholder art (seed/art.ts): SVG rasterized with
// sharp through the same pipeline the editor applies to uploads (WebP, longest
// edge ≤ 2000px), then stored where the app's storage facade would store it —
// Cloudflare R2 when configured, local disk otherwise (see seed-storage.ts) —
// so the reader serves the seeded issues on any machine and any deploy, with no
// repo binaries and no cloud required.
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import sharp from "sharp";
import { issueContentSchema } from "../lib/blocks";
import {
  DEFAULT_FOOTER_STYLE,
  MARK_SIZE,
  TEXT_SIZE,
  clampSize,
  type FooterReserve,
} from "../lib/branding";
import { images, issues, logos, settings } from "./schema";
import { buildIssues } from "./seed-data";
import { renderArtSvg, type SeedArtSpec } from "./seed/art";
import { SEED_LOGOS } from "./seed/cover-elements";
import { SEED_IMAGES, type SeedImages } from "./seed/images";
import { putSeedObject } from "./seed-storage";

export type SeedDb = PostgresJsDatabase;
export type SeedTx = Parameters<Parameters<SeedDb["transaction"]>[0]>[0];

const id = () => crypto.randomUUID();

// Same key shape the app uses; served at the R2 public URL when R2 is
// configured, at /api/images/<key> in local mode.
const seedKey = (spec: SeedArtSpec) => `seed/${spec.key}.webp`;

// The storage keys a seed writes — fixed, so each run overwrites the last.
export const SEED_OBJECT_KEYS = SEED_IMAGES.map(seedKey);

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

  const key = seedKey(spec);
  await putSeedObject(key, data, "image/webp");
  return { key, width: info.width, height: info.height };
}

// `clearMore` runs first inside the wipe transaction, for callers that remove
// more than the seed replaces.
export async function seedIssues(
  db: SeedDb,
  clearMore?: (tx: SeedTx) => Promise<void>,
): Promise<{ issues: number; images: number }> {
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
  // Record the footer in force as each issue's reserve, as createIssue does
  // (#128); the column default is the smallest preset and would hold the demo
  // issues below the footer they were designed for.
  const [stored] = await db
    .select({
      footerMarkSize: settings.footerMarkSize,
      footerTextSize: settings.footerTextSize,
    })
    .from(settings)
    .limit(1);
  const reserve: FooterReserve = {
    footerMarkSize: clampSize(
      MARK_SIZE,
      stored?.footerMarkSize ?? DEFAULT_FOOTER_STYLE.markSize,
    ),
    footerTextSize: clampSize(
      TEXT_SIZE,
      stored?.footerTextSize ?? DEFAULT_FOOTER_STYLE.textSize,
    ),
  };
  const rows = buildIssues(imageIds).map((issue) => ({ ...issue, ...reserve }));

  for (const row of rows) issueContentSchema.parse(row.content);

  await db.transaction(async (tx) => {
    await clearMore?.(tx);
    // Wipe (images first — they FK onto issues; all logos cascade with them).
    await tx.delete(images);
    await tx.delete(issues);
    await tx.insert(images).values(imageRows);
    await tx.insert(logos).values(
      SEED_LOGOS.map((logo) => ({
        id: logo.id,
        name: logo.name,
        imageId: imageIds[logo.imageKey],
      })),
    );
    await tx.insert(issues).values(rows);
  });

  return { issues: rows.length, images: imageRows.length };
}

// True when the database holds any published issue — the seed's cue that it
// may be about to wipe real content.
export async function hasPublishedIssues(db: SeedDb): Promise<boolean> {
  const [published] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.status, "published"))
    .limit(1);
  return Boolean(published);
}
