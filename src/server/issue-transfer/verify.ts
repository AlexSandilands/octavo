import "server-only";
import { createHash } from "node:crypto";
import { CONTENT_VERSION } from "@/lib/blocks";
import { inspectStoredImage, MAX_EDGE } from "@/lib/image-processing";
import {
  checkBundledIssue,
  type BundledIssue,
} from "@/lib/issue-transfer/document";
import {
  IMAGE_VERIFY_CONCURRENCY,
  MAX_IMAGE_BYTES,
  MAX_ISSUE_FILE_BYTES,
  MAX_MANIFEST_BYTES,
} from "@/lib/issue-transfer/limits";
import {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  checkManifest,
  GENERIC_REFUSAL,
  manifestEnvelopeSchema,
  manifestSchema,
  MANIFEST_PATH,
  refuse,
  type BundleManifest,
  type ManifestImage,
  type Refusal,
} from "@/lib/issue-transfer/manifest";
import { InflationBudgetError, type BundleArchive } from "./archive";

// Everything an archive can be wrong about, decided before a single row or
// object is written (docs/issue-transfer.md).

export type VerifiedBundle = {
  manifest: BundleManifest;
  documents: { manifestId: string; issue: BundledIssue }[];
};

export type VerifyResult =
  | { ok: true; bundle: VerifiedBundle }
  | { ok: false; refusal: Refusal };

export async function verifyBundle(
  archive: BundleArchive,
): Promise<VerifyResult> {
  try {
    return await checkArchive(archive);
  } catch (err) {
    if (err instanceof InflationBudgetError) {
      return {
        ok: false,
        refusal: refuse(
          "too-much-content",
          "This export unpacks to more than this site can take in one import.",
        ),
      };
    }
    throw err;
  }
}

async function checkArchive(archive: BundleArchive): Promise<VerifyResult> {
  if (!archive.has(MANIFEST_PATH) || archive.duplicated.has(MANIFEST_PATH)) {
    return { ok: false, refusal: GENERIC_REFUSAL };
  }

  let raw: Buffer;
  try {
    raw = await archive.read(MANIFEST_PATH, MAX_MANIFEST_BYTES);
  } catch {
    return { ok: false, refusal: GENERIC_REFUSAL };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return { ok: false, refusal: GENERIC_REFUSAL };
  }

  // The envelope first, so a bundle from another tool or a future format says so
  // instead of failing as "not a valid export".
  const envelope = manifestEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) return { ok: false, refusal: GENERIC_REFUSAL };
  const { format, formatVersion } = envelope.data;
  if (format !== BUNDLE_FORMAT) return { ok: false, refusal: GENERIC_REFUSAL };
  if (formatVersion !== BUNDLE_FORMAT_VERSION) {
    return {
      ok: false,
      refusal: refuse(
        "format-too-new",
        "This export was made by a newer version of the site. Update this site first.",
      ),
    };
  }

  const manifest = manifestSchema.safeParse(parsed);
  if (!manifest.success) return { ok: false, refusal: GENERIC_REFUSAL };
  const bundle = manifest.data;

  if (bundle.contentVersion > CONTENT_VERSION) {
    return {
      ok: false,
      refusal: refuse(
        "content-too-new",
        "This export was made by a newer version of the site. Update this site first.",
      ),
    };
  }

  const manifestRefusal = checkManifest(bundle);
  if (manifestRefusal) return { ok: false, refusal: manifestRefusal };

  for (const entry of [...bundle.issues, ...bundle.images]) {
    if (archive.duplicated.has(entry.file)) {
      return { ok: false, refusal: GENERIC_REFUSAL };
    }
    if (!archive.has(entry.file)) {
      return {
        ok: false,
        refusal: refuse(
          "missing-file",
          "This export is incomplete — one of the files it lists isn’t in the archive.",
        ),
      };
    }
  }

  const documents: VerifiedBundle["documents"] = [];
  for (const entry of bundle.issues) {
    if (entry.bytes > MAX_ISSUE_FILE_BYTES) {
      return { ok: false, refusal: tooLarge(entry.title) };
    }
    const bytes = await readExact(archive, entry.file, entry);
    if (!bytes) return { ok: false, refusal: damaged() };
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch {
      return { ok: false, refusal: damaged() };
    }
    const checked = checkBundledIssue(value, entry.title);
    if (!checked.ok) return { ok: false, refusal: checked.refusal };
    documents.push({ manifestId: entry.id, issue: checked.issue });
  }

  const imageRefusal = await verifyImages(archive, bundle.images);
  if (imageRefusal) return { ok: false, refusal: imageRefusal };

  return { ok: true, bundle: { manifest: bundle, documents } };
}

/** Inflate one entry capped at the size it declares, and check it is exactly
 *  those bytes. A bigger entry trips the cap while inflating; a smaller or
 *  altered one fails the hash. */
async function readExact(
  archive: BundleArchive,
  file: string,
  entry: { bytes: number; sha256: string },
): Promise<Buffer | null> {
  let bytes: Buffer;
  try {
    bytes = await archive.read(file, entry.bytes);
  } catch (err) {
    // Anything the archive throws about one entry — over its declared size, a
    // failed CRC, a truncated stream — means the file is not what the manifest
    // says. Only the whole-bundle budget escapes, because that is its own
    // refusal.
    if (err instanceof InflationBudgetError) throw err;
    return null;
  }
  if (bytes.length !== entry.bytes) return null;
  const digest = createHash("sha256").update(bytes).digest("hex");
  return digest === entry.sha256 ? bytes : null;
}

async function verifyImages(
  archive: BundleArchive,
  images: ManifestImage[],
): Promise<Refusal | null> {
  let next = 0;
  let refusal: Refusal | null = null;

  const worker = async () => {
    while (refusal === null) {
      const entry = images[next++];
      if (!entry) return;
      const result = await verifyImage(archive, entry);
      if (result && refusal === null) refusal = result;
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(IMAGE_VERIFY_CONCURRENCY, images.length) },
      worker,
    ),
  );
  return refusal;
}

async function verifyImage(
  archive: BundleArchive,
  entry: ManifestImage,
): Promise<Refusal | null> {
  if (entry.bytes > MAX_IMAGE_BYTES) {
    return refuse(
      "image-too-large",
      `One of the photos in this export is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB, which this site can’t store.`,
    );
  }
  const bytes = await readExact(archive, entry.file, entry);
  if (!bytes) return damaged();

  const info = await inspectStoredImage(bytes);
  if (
    !info ||
    info.format !== "webp" ||
    info.width !== entry.width ||
    info.height !== entry.height ||
    info.width > MAX_EDGE ||
    info.height > MAX_EDGE
  ) {
    return refuse(
      "bad-image",
      "One of the photos in this export isn’t a picture this site can read.",
    );
  }
  return null;
}

function damaged(): Refusal {
  return refuse(
    "damaged",
    "This export looks damaged — one of its files isn’t what the file list says it is.",
  );
}

function tooLarge(title: string): Refusal {
  return refuse(
    "document-too-large",
    `“${title.trim() || "Untitled"}” is too big to edit on this site. Split it into two issues and export again.`,
  );
}
