// Fresh images for a case that builds a new issue (setup.generatedImages): the
// seed's art renderer with a new palette, each labelled in one corner with its
// role ("PHOTO · prize leeks on the scales") so a model with vision can tell
// which is which. The role never reaches the projection. Real photos dropped in
// photos/ replace the generated art, in order, and carry no label.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderArtSvg, type ArtStyle } from "../../../src/db/seed/art.ts";
import type { ImageInfo, LogoInfo } from "./seed.ts";

export const CACHE_DIR = join(import.meta.dirname, ".cache");
export const PHOTOS_DIR = join(import.meta.dirname, "photos");

export type GeneratedSpec = {
  id: string;
  role: string;
  width: number;
  height: number;
};

// An allotment palette: soil, leaf, pale morning, marigold.
const PALETTE = {
  deep: "#3b2f24",
  mid: "#5f7a3a",
  light: "#efe8d2",
  accent: "#e0902a",
};
const STYLES: ArtStyle[] = [
  { kind: "duotone", motif: "stripes" },
  { kind: "field", motif: "dots" },
  { kind: "duotone", motif: "arcs" },
  { kind: "duotone", motif: "triangles" },
  { kind: "field", motif: "rings" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function label(role: string, width: number, height: number): Buffer {
  const size = Math.round(Math.min(width, height) * 0.03);
  const text = `PHOTO · ${role}`;
  const w = Math.min(
    width - 2 * size,
    Math.round(text.length * size * 0.6 + size * 1.6),
  );
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${size}" y="${height - size * 3.2}" width="${w}" height="${size * 2.2}" rx="${size * 0.3}" fill="#ffffff" fill-opacity="0.85"/>
      <text x="${size * 1.8}" y="${height - size * 1.65}" font-family="sans-serif" font-size="${size}" fill="#222">${esc(text)}</text>
    </svg>`,
  );
}

/** Write (or reuse) each image; returns them with the files set. */
export async function generateImages(
  specs: GeneratedSpec[],
): Promise<ImageInfo[]> {
  const dir = join(CACHE_DIR, "generated");
  mkdirSync(dir, { recursive: true });
  const photos = existsSync(PHOTOS_DIR)
    ? readdirSync(PHOTOS_DIR)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort()
    : [];
  const out: ImageInfo[] = [];
  for (const [i, spec] of specs.entries()) {
    const file = join(dir, `${spec.id}.webp`);
    const photo = photos[i];
    if (photo) {
      const { data, info } = await sharp(join(PHOTOS_DIR, photo))
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      writeFileSync(file, data);
      out.push({ id: spec.id, width: info.width, height: info.height, file });
      continue;
    }
    // The first portrait image is the cover: a landscape wash, like the seed's covers.
    const style: ArtStyle =
      i === 0 ? { kind: "wash" } : STYLES[i % STYLES.length]!;
    const svg = renderArtSvg({
      key: `spike-${spec.id}`,
      width: spec.width,
      height: spec.height,
      palette: PALETTE,
      style,
    });
    const data = await sharp(Buffer.from(svg))
      .composite([{ input: label(spec.role, spec.width, spec.height) }])
      .webp({ quality: 82 })
      .toBuffer();
    writeFileSync(file, data);
    out.push({ id: spec.id, width: spec.width, height: spec.height, file });
  }
  return out;
}

/**
 * Every photo in `dir` as an unplaced upload. Ids are opaque (hashed from the
 * case and index, uuid-shaped like production's) and the list is sorted by id,
 * so neither the file names nor their order say what a photo shows.
 */
export async function loadPhotos(
  dir: string,
  caseId: string,
): Promise<ImageInfo[]> {
  const out = join(CACHE_DIR, "photos", caseId);
  mkdirSync(out, { recursive: true });
  const files = readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  const photos: ImageInfo[] = [];
  for (const [i, f] of files.entries()) {
    const h = createHash("sha256").update(`${caseId}:${i}`).digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    const file = join(out, `${id}.webp`);
    const { data, info } = await sharp(join(dir, f))
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    writeFileSync(file, data);
    photos.push({ id, width: info.width, height: info.height, file });
  }
  return photos.sort((a, b) => a.id.localeCompare(b.id));
}

/** A simple round mark for the case's club: a leaf over a spade, or a boule and jack. */
export async function generateLogo(
  name: string,
): Promise<{ logo: LogoInfo; image: ImageInfo }> {
  const dir = join(CACHE_DIR, "generated");
  mkdirSync(dir, { recursive: true });
  const slug = createHash("sha256").update(name).digest("hex").slice(0, 8);
  const file = join(dir, `logo-${slug}.webp`);
  const ring = `<circle cx="120" cy="120" r="108" fill="none" stroke="${PALETTE.light}" stroke-width="8"/>`;
  const art = /boule|p[ée]tanque/i.test(name)
    ? `<circle cx="104" cy="128" r="46" fill="${PALETTE.light}"/>
       <path d="M62 116 Q104 100 146 116 M62 140 Q104 156 146 140" stroke="${PALETTE.deep}" stroke-width="4" fill="none"/>
       <circle cx="166" cy="84" r="14" fill="${PALETTE.accent}"/>`
    : `<path d="M120 58 C160 70 170 112 120 150 C70 112 80 70 120 58 Z" fill="${PALETTE.mid}"/>
       <path d="M120 70 L120 150" stroke="${PALETTE.light}" stroke-width="5"/>
       <rect x="112" y="150" width="16" height="42" fill="${PALETTE.light}"/>
       <path d="M96 150 L144 150 L136 170 L104 170 Z" fill="${PALETTE.light}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${ring}${art}</svg>`;
  writeFileSync(
    file,
    await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer(),
  );
  const imageId = `img-logo-${slug}`;
  return {
    logo: { id: `logo-${slug}`, name, imageId },
    image: { id: imageId, width: 240, height: 240, file },
  };
}
