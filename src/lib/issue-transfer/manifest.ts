import { z } from "zod";
import { ISSUE_TITLE_MAX } from "../editor-save";
import {
  MAX_BUNDLE_BYTES,
  MAX_BUNDLE_ENTRIES,
  MAX_BUNDLE_ISSUES,
} from "./limits";

// The bundle's contract (docs/issue-transfer.md). `manifest.json` is the only
// entry read before anything is trusted, so every field here is bounded and the
// object is strict: an unknown key is a bundle this site does not understand.

export const BUNDLE_FORMAT = "octavo-issues";
export const BUNDLE_FORMAT_VERSION = 1;
export const MANIFEST_PATH = "manifest.json";

/** The two entry path shapes. A listed file must match its own id exactly; no
 *  other name in the archive is ever read. */
export const issueEntryPath = (id: string) => `issues/${id}/issue.json`;
export const imageEntryPath = (id: string) => `images/${id}.webp`;

// Ids come from the source database (uuids today) and are only ever used as a
// map key and as one path segment, which the shape check above pins down.
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const pathSchema = z.string().max(200);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const byteCountSchema = z.number().int().min(0).max(MAX_BUNDLE_BYTES);
const nameSchema = z.string().min(1).max(300);

const manifestIssueSchema = z
  .object({
    id: idSchema,
    file: pathSchema,
    title: z.string().max(ISSUE_TITLE_MAX),
    bytes: byteCountSchema,
    sha256: sha256Schema,
  })
  .strict();

const manifestImageSchema = z
  .object({
    id: idSchema,
    file: pathSchema,
    width: z.number().int().min(1).max(100_000),
    height: z.number().int().min(1).max(100_000),
    bytes: byteCountSchema,
    sha256: sha256Schema,
  })
  .strict();

const manifestSponsorSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    href: z.string().max(2000).nullable(),
    activeUntil: z.string().datetime({ offset: true }).nullable(),
    logoImageId: idSchema.nullable(),
  })
  .strict();

const manifestLogoSchema = z
  .object({ id: idSchema, name: nameSchema, imageId: idSchema })
  .strict();

export const manifestSchema = z
  .object({
    format: z.literal(BUNDLE_FORMAT),
    formatVersion: z.literal(BUNDLE_FORMAT_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    contentVersion: z.number().int().min(1),
    issues: z.array(manifestIssueSchema).min(1).max(MAX_BUNDLE_ISSUES),
    images: z.array(manifestImageSchema).max(MAX_BUNDLE_ENTRIES),
    sponsors: z.array(manifestSponsorSchema).max(MAX_BUNDLE_ENTRIES),
    logos: z.array(manifestLogoSchema).max(MAX_BUNDLE_ENTRIES),
  })
  .strict();

export type BundleManifest = z.infer<typeof manifestSchema>;
export type ManifestIssue = BundleManifest["issues"][number];
export type ManifestImage = BundleManifest["images"][number];
export type ManifestSponsor = BundleManifest["sponsors"][number];
export type ManifestLogo = BundleManifest["logos"][number];

/** Read before the full schema, so an archive from a newer or foreign exporter
 *  gets its own message instead of a generic "not a valid export". */
export const manifestEnvelopeSchema = z.object({
  format: z.string().max(64).optional(),
  formatVersion: z.number().optional(),
});

/** A refusal an admin can act on: `code` for the gate, `message` for the modal. */
export type Refusal = { code: string; message: string };

export function refuse(code: string, message: string): Refusal {
  return { code, message };
}

export const GENERIC_REFUSAL = refuse(
  "not-a-bundle",
  "This file isn’t a valid issue export.",
);

/** Names match case- and space-insensitively, so "Acme Ltd" and "acme  ltd"
 *  are one sponsor. Used on both sides of every library comparison. */
export function normaliseLibraryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

// Everything the manifest can be wrong about on its own, before a single entry
// is read: repeated ids or paths, a path that doesn't belong to its id, a
// library row pointing at an image the bundle doesn't list, two library entries
// the destination could not tell apart, and more entries than the caps allow.
export function checkManifest(manifest: BundleManifest): Refusal | null {
  const issueCount = manifest.issues.length;
  const entries = issueCount + manifest.images.length;
  if (entries > MAX_BUNDLE_ENTRIES) {
    return refuse(
      "too-many-entries",
      `This export lists ${entries} files. The most this site can import at once is ${MAX_BUNDLE_ENTRIES}.`,
    );
  }

  const paths = new Set<string>([MANIFEST_PATH]);
  const seen = { issues: new Set<string>(), images: new Set<string>() };

  for (const issue of manifest.issues) {
    if (seen.issues.has(issue.id)) {
      return refuse("duplicate-id", "This export lists the same issue twice.");
    }
    seen.issues.add(issue.id);
    if (issue.file !== issueEntryPath(issue.id) || paths.has(issue.file)) {
      return GENERIC_REFUSAL;
    }
    paths.add(issue.file);
  }

  for (const image of manifest.images) {
    if (seen.images.has(image.id)) {
      return refuse("duplicate-id", "This export lists the same image twice.");
    }
    seen.images.add(image.id);
    if (image.file !== imageEntryPath(image.id) || paths.has(image.file)) {
      return GENERIC_REFUSAL;
    }
    paths.add(image.file);
  }

  const libraryRefusal =
    checkLibraryList(manifest.sponsors, "sponsor") ??
    checkLibraryList(manifest.logos, "logo");
  if (libraryRefusal) return libraryRefusal;

  for (const sponsor of manifest.sponsors) {
    if (sponsor.logoImageId && !seen.images.has(sponsor.logoImageId)) {
      return GENERIC_REFUSAL;
    }
  }
  for (const logo of manifest.logos) {
    if (!seen.images.has(logo.imageId)) return GENERIC_REFUSAL;
  }
  return null;
}

// Ids unique, and names unique once normalised — two bundled sponsors called
// "Acme" and "acme" would race for the same destination row.
function checkLibraryList(
  rows: { id: string; name: string }[],
  kind: "sponsor" | "logo",
): Refusal | null {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) return GENERIC_REFUSAL;
    ids.add(row.id);
    const key = normaliseLibraryName(row.name);
    if (names.has(key)) {
      return refuse(
        "duplicate-library-name",
        `This export has two ${kind}s named “${row.name.trim()}”. Rename one at the source and export again.`,
      );
    }
    names.add(key);
  }
  return null;
}
