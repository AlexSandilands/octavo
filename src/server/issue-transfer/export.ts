import "server-only";
import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { images, issues, logos, sponsors } from "@/db/schema";
import { CONTENT_VERSION } from "@/lib/blocks";
import { imageSites } from "@/lib/image-sites";
import { collectImageIds } from "@/lib/images";
import { collectSponsorIds } from "@/lib/sponsors";
import {
  checkExportSelection,
  MAX_BUNDLE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_ISSUE_FILE_BYTES,
} from "@/lib/issue-transfer/limits";
import {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  imageEntryPath,
  issueEntryPath,
  MANIFEST_PATH,
  refuse,
  type BundleManifest,
  type Refusal,
} from "@/lib/issue-transfer/manifest";
import type { ExportOmissions } from "@/lib/issue-transfer/result";
import { getObject } from "@/lib/storage";
import { streamZip } from "./zip";

// Building a bundle. Everything is read and measured before a single byte of
// the response is sent, for two reasons: the manifest carries each file's size
// and hash, and an export that cannot be honoured — over the limits, or storage
// refusing to answer — has to be refused while it is still a message on screen
// rather than a half-written download.
//
// A row or object that is genuinely **absent** is left out and reported. A
// storage **read error** fails the whole export: a temporary outage must never
// quietly ship a bundle with holes in it.

export type ExportResult =
  | { ok: false; refusal: Refusal }
  | {
      ok: true;
      filename: string;
      omitted: ExportOmissions;
      body: ReadableStream<Uint8Array>;
    };

/** An image entry: read once to measure and hash it, read again as it is sent,
 *  so only one object's bytes are ever held. */
type ImageEntry = { file: string; key: string; bytes: number };

export async function buildExport(ids: string[]): Promise<ExportResult> {
  const unique = [...new Set(ids)];
  const selection = checkExportSelection(unique.length);
  if (!selection.ok) {
    return { ok: false, refusal: refuse("too-many", selection.message) };
  }

  const rows = await db.select().from(issues).where(inArray(issues.id, unique));
  if (rows.length === 0) {
    return {
      ok: false,
      refusal: refuse("nothing-to-export", "Those issues are no longer here."),
    };
  }
  const omitted: ExportOmissions = {};
  const omit = (kind: keyof ExportOmissions, count = 1) => {
    omitted[kind] = (omitted[kind] ?? 0) + count;
  };
  if (rows.length < unique.length) omit("issue", unique.length - rows.length);

  const documents = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: serialise({
      title: row.title,
      theme: row.theme,
      content: row.content,
      footerMarkSize: row.footerMarkSize,
      footerTextSize: row.footerTextSize,
      logoId: row.logoId,
      number: row.number,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    }),
  }));
  const oversized = documents.find(
    (doc) => doc.body.length > MAX_ISSUE_FILE_BYTES,
  );
  if (oversized) {
    return {
      ok: false,
      refusal: refuse(
        "issue-too-large",
        `“${oversized.title}” is too large to export. Deselect it and try again.`,
      ),
    };
  }

  // Which library rows the selection references: managed sponsors from sponsor
  // blocks, logos from cover logo elements and each issue's footer mark.
  const sponsorIds = new Set<string>();
  const logoIds = new Set<string>();
  const imageIds = new Set<string>();
  for (const row of rows) {
    for (const id of collectSponsorIds(row.content)) sponsorIds.add(id);
    for (const id of collectImageIds(row.content)) imageIds.add(id);
    for (const site of imageSites(row.content)) {
      if (site.kind === "coverLogo" && site.element.logoId) {
        logoIds.add(site.element.logoId);
      }
    }
    if (row.logoId) logoIds.add(row.logoId);
  }

  const sponsorRows = sponsorIds.size
    ? await db
        .select()
        .from(sponsors)
        .where(inArray(sponsors.id, [...sponsorIds]))
    : [];
  const logoRows = logoIds.size
    ? await db
        .select()
        .from(logos)
        .where(inArray(logos.id, [...logoIds]))
    : [];
  if (sponsorRows.length < sponsorIds.size) {
    omit("sponsor", sponsorIds.size - sponsorRows.length);
  }
  if (logoRows.length < logoIds.size) {
    omit("logo", logoIds.size - logoRows.length);
  }
  for (const sponsor of sponsorRows) {
    if (sponsor.logoId) imageIds.add(sponsor.logoId);
  }
  for (const logo of logoRows) imageIds.add(logo.imageId);

  const imageRows = imageIds.size
    ? await db
        .select()
        .from(images)
        .where(inArray(images.id, [...imageIds]))
    : [];
  if (imageRows.length < imageIds.size) {
    omit("image", imageIds.size - imageRows.length);
  }

  // One read per object: it is the only way to know the size and hash the
  // manifest has to carry, and it is where "absent" and "storage did not
  // answer" are told apart.
  const imageEntries: ImageEntry[] = [];
  const manifestImages: BundleManifest["images"] = [];
  let total = documents.reduce((sum, doc) => sum + doc.body.length, 0);
  for (const row of imageRows) {
    const bytes = await getObject(row.key);
    if (!bytes) {
      omit("image");
      continue;
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        refusal: refuse(
          "image-too-large",
          "One of the photos in this selection is too large to export. Deselect the issue that uses it.",
        ),
      };
    }
    total += bytes.length;
    if (total > MAX_BUNDLE_BYTES) {
      return {
        ok: false,
        refusal: refuse(
          "too-large",
          `This selection is larger than the ${Math.round(MAX_BUNDLE_BYTES / (1024 * 1024))} MB an import can take. Deselect some issues and try again.`,
        ),
      };
    }
    const file = imageEntryPath(row.id);
    imageEntries.push({ file, key: row.key, bytes: bytes.length });
    manifestImages.push({
      id: row.id,
      file,
      width: row.width ?? 0,
      height: row.height ?? 0,
      bytes: bytes.length,
      sha256: digest(bytes),
    });
  }

  const present = new Set(manifestImages.map((image) => image.id));
  const manifest: BundleManifest = {
    format: BUNDLE_FORMAT,
    formatVersion: BUNDLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    contentVersion: CONTENT_VERSION,
    issues: documents.map((doc) => ({
      id: doc.id,
      file: issueEntryPath(doc.id),
      title: doc.title,
      bytes: doc.body.length,
      sha256: digest(doc.body),
    })),
    images: manifestImages,
    // A library row whose artwork went missing would describe an image the
    // bundle cannot supply, so it is left out with it.
    sponsors: sponsorRows
      .filter((row) => !row.logoId || present.has(row.logoId))
      .map((row) => ({
        id: row.id,
        name: row.name,
        href: row.href,
        activeUntil: row.activeUntil?.toISOString() ?? null,
        logoImageId: row.logoId,
      })),
    logos: logoRows
      .filter((row) => present.has(row.imageId))
      .map((row) => ({ id: row.id, name: row.name, imageId: row.imageId })),
  };
  omit("sponsor", sponsorRows.length - manifest.sponsors.length);
  omit("logo", logoRows.length - manifest.logos.length);
  for (const kind of ["issue", "image", "sponsor", "logo"] as const) {
    if (omitted[kind] === 0) delete omitted[kind];
  }

  const body = streamZip(async (add) => {
    await add(MANIFEST_PATH, serialise(manifest));
    for (const doc of documents) {
      await add(issueEntryPath(doc.id), doc.body);
    }
    for (const entry of imageEntries) {
      const bytes = await getObject(entry.key);
      // The manifest already names this file, so an object that has gone in the
      // meantime would make the bundle a lie. Better a failed download.
      if (!bytes || bytes.length !== entry.bytes) {
        throw new Error(`Export source changed: ${entry.key}`);
      }
      await add(entry.file, bytes, { store: true });
    }
  });

  return { ok: true, filename: exportFilename(), omitted, body };
}

function serialise(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Fixed and ASCII on purpose: no magazine name means no RFC 8187 ext-value and
// no header-escaping question (unlike the PDF download, issue #138).
function exportFilename(): string {
  return `octavo-issues-${new Date().toISOString().slice(0, 10)}.zip`;
}
