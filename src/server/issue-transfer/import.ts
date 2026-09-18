import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { images, issues, logos, sponsors } from "@/db/schema";
import type { ImportDecision } from "@/lib/issue-transfer/decisions";
import { MAX_INFLATED_BYTES } from "@/lib/issue-transfer/limits";
import {
  GENERIC_REFUSAL,
  imageEntryPath,
  refuse,
  type BundleManifest,
  type Refusal,
} from "@/lib/issue-transfer/manifest";
import {
  mintIds,
  resolveBundle,
  type ResolvedBundle,
} from "@/lib/issue-transfer/resolve";
import type {
  ImportPhase,
  ImportResponse,
  ImportResult,
} from "@/lib/issue-transfer/result";
import { deleteObject, putObject } from "@/lib/storage";
import { openBundle, type BundleArchive } from "./archive";
import { throwIfInjected } from "./fault";
import { report } from "./report";
import { readLibrary } from "./library";
import {
  abandonImport,
  beginImport,
  importObjectKey,
  markCommitted,
  sweepAbandonedImports,
} from "./operations";
import { verifyBundle, type VerifiedBundle } from "./verify";

// Importing a bundle, in the order that makes the guarantee true: **database
// changes are atomic; object cleanup is immediate when possible and recoverable
// afterwards when it is not.**
//
//   validate (writes nothing) → claim the operation → write the objects →
//   ONE transaction inserts every row and marks the operation committed →
//   respond.
//
// Anything that goes wrong after the operation is claimed deletes
// `imports/<id>/` at once; if that fails the row stays `started` and the sweep
// finishes the job later. Nothing here is tied to the request's abort signal:
// once checking has begun the server finishes even if the browser has gone, so
// a retry with the same operation id gets the recorded answer.
//
// No `revalidatePath`: the dashboard is force-dynamic and the modal refreshes
// the router when the result lands, and this routine is driven in-process by
// the gate as well as from a request.

// Imports are serialised against each other: two arriving at once must not both
// decide to create "Acme". Transaction-scoped, so it is released by the commit
// or the rollback and can never be left held.
const IMPORT_LOCK_KEY = 293_000_001;

export type ImportInput = {
  file: string;
  adminId: string;
  operationId: string;
  decisions: ImportDecision[];
  onPhase?: (phase: ImportPhase) => void;
};

export async function importBundle(
  input: ImportInput,
): Promise<ImportResponse> {
  await sweepAbandonedImports();
  input.onPhase?.("checking");

  const opened = await openBundle(input.file, MAX_INFLATED_BYTES);
  if (!opened.ok) {
    return fail(
      opened.reason === "too-many-entries"
        ? refuse(
            "too-many-entries",
            "This export holds more files than this site can take in one import.",
          )
        : GENERIC_REFUSAL,
    );
  }

  try {
    return await runImport(input, opened.archive);
  } finally {
    await opened.archive.close().catch(() => {});
  }
}

async function runImport(
  input: ImportInput,
  archive: BundleArchive,
): Promise<ImportResponse> {
  const verified = await verifyBundle(archive);
  if (!verified.ok) return fail(verified.refusal);
  const { manifest, documents } = verified.bundle;

  const decided = checkDecisions(input.decisions, manifest);
  if (decided) return fail(decided);

  // Ids are minted once and used by both resolution passes, so the keys written
  // below are the keys the committed rows name.
  const ids = mintIds(manifest);
  const planned = resolveBundle({
    manifest,
    documents,
    destination: await readLibrary(),
    ids,
  });
  if (!planned.ok) return fail(planned.refusal);

  const claim = await beginImport(input.operationId, input.adminId);
  if (claim.state === "committed") {
    return { ok: true, result: claim.result, retried: true };
  }
  if (claim.state === "running") {
    return fail(
      refuse(
        "still-running",
        "This import is still going. Give it a moment, then try again.",
      ),
    );
  }
  if (claim.state === "abandoned") {
    return fail(
      refuse(
        "abandoned",
        "That import didn’t finish. Close this and choose the file again.",
      ),
    );
  }

  input.onPhase?.("importing");
  try {
    const written = await writeImages(
      archive,
      manifest,
      planned.bundle,
      input.operationId,
    );
    return {
      ok: true,
      result: await commit(input, verified.bundle, ids, written),
    };
  } catch (err) {
    await abandonImport(input.operationId);
    if (err instanceof LibraryMovedError) return fail(err.refusal);
    report(err, { operationId: input.operationId, adminId: input.adminId });
    return fail(
      refuse(
        "failed",
        "The import didn’t go through, and nothing was changed. Please try again.",
      ),
    );
  }
}

class LibraryMovedError extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.code);
  }
}

/** Every bundled issue needs exactly one decision, and no decision may name an
 *  issue the bundle does not hold — a client and a file that disagree is a bug,
 *  not something to guess at. */
function checkDecisions(
  decisions: ImportDecision[],
  manifest: BundleManifest,
): Refusal | null {
  const wanted = new Set(manifest.issues.map((issue) => issue.id));
  const given = new Set(decisions.map((decision) => decision.issueId));
  const same =
    given.size === decisions.length &&
    given.size === wanted.size &&
    [...wanted].every((id) => given.has(id));
  return same ? null : GENERIC_REFUSAL;
}

/** The bundled images at least one surviving use needs, written under the
 *  operation's prefix. Bytes go in exactly as they came out — never re-encoded. */
async function writeImages(
  archive: BundleArchive,
  manifest: BundleManifest,
  planned: ResolvedBundle,
  operationId: string,
): Promise<Map<string, string>> {
  const sizes = new Map(
    manifest.images.map((image) => [image.id, image.bytes]),
  );
  const written = new Map<string, string>();
  for (const image of planned.images) {
    // After the first one, so the gate can fail an import *partway through*.
    if (written.size > 0) throwIfInjected("objects");
    const bytes = await archive.read(
      imageEntryPath(image.bundleId),
      sizes.get(image.bundleId) ?? 0,
    );
    await putObject(
      importObjectKey(operationId, image.id),
      bytes,
      "image/webp",
    );
    written.set(image.bundleId, image.id);
  }
  return written;
}

// The one transaction. It re-reads the library under the advisory lock and
// resolves again, because the first pass ran unlocked: another import that
// committed in between may already have created the sponsor this one was going
// to. Adapting is the point — that is what makes two concurrent imports of the
// same bundle create each entry once. The one thing it cannot adapt to is a
// library row disappearing, which would need bytes that are no longer coming.
async function commit(
  input: { operationId: string },
  verified: VerifiedBundle,
  ids: ReturnType<typeof mintIds>,
  written: Map<string, string>,
): Promise<ImportResult> {
  const { manifest, documents } = verified;
  const sizes = new Map(manifest.images.map((i) => [i.id, i]));
  const sponsorRows = new Map(manifest.sponsors.map((s) => [s.id, s]));

  const { result, surplus } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`);

    const final = resolveBundle({
      manifest,
      documents,
      destination: await readLibrary(tx),
      ids,
    });
    if (!final.ok) throw new LibraryMovedError(final.refusal);

    const bundle = final.bundle;
    const missing = bundle.images.find((i) => !written.has(i.bundleId));
    if (missing) {
      throw new LibraryMovedError(
        refuse(
          "library-moved",
          "The sponsors or logos on this site changed while the import was running. Please try again.",
        ),
      );
    }

    // images.issueId → issues.id and issues.logoId → logos.id → logos.imageId →
    // images.id is a cycle, so the rows go in dependency order and the images
    // adopt their issue once it exists.
    for (const image of bundle.images) {
      const entry = sizes.get(image.bundleId)!;
      await tx.insert(images).values({
        id: image.id,
        key: importObjectKey(input.operationId, image.id),
        width: entry.width,
        height: entry.height,
        issueId: null,
      });
    }
    for (const logo of bundle.logos) {
      if (logo.action === "create" && logo.imageId) {
        await tx
          .insert(logos)
          .values({ id: logo.id, name: logo.name, imageId: logo.imageId });
      }
    }
    for (const sponsor of bundle.sponsors) {
      if (sponsor.action !== "create") continue;
      const source = sponsorRows.get(sponsor.manifestId)!;
      await tx.insert(sponsors).values({
        id: sponsor.id,
        name: sponsor.name,
        href: source.href,
        logoId: sponsor.imageId,
        activeUntil: source.activeUntil ? new Date(source.activeUntil) : null,
      });
    }
    for (const issue of bundle.issues) {
      // A fresh draft every time: no number, revision 0, never published.
      await tx.insert(issues).values({
        id: issue.id,
        title: issue.title,
        theme: issue.theme,
        status: "draft",
        content: issue.content,
        footerMarkSize: issue.footerMarkSize,
        footerTextSize: issue.footerTextSize,
        logoId: issue.logoId,
      });
    }
    for (const image of bundle.images) {
      if (!image.issueId) continue;
      await tx
        .update(images)
        .set({ issueId: image.issueId })
        .where(eq(images.id, image.id));
    }

    throwIfInjected("transaction");

    const result: ImportResult = {
      issues: bundle.issues.map((i) => ({ id: i.id, title: i.title })),
      sponsors: bundle.sponsors.map((s) => ({
        name: s.name,
        action: s.action,
      })),
      logos: bundle.logos.map((l) => ({ name: l.name, action: l.action })),
      cleared: bundle.cleared,
    };
    await markCommitted(tx, input.operationId, result);

    const needed = new Set(bundle.images.map((i) => i.bundleId));
    const surplus = [...written]
      .filter(([bundleId]) => !needed.has(bundleId))
      .map(([, id]) => importObjectKey(input.operationId, id));
    return { result, surplus };
  });

  // Committed. An object the first pass uploaded for a library entry the second
  // pass found already there belongs to nothing — best-effort, like every other
  // post-commit sweep (server/asset-cleanup.ts).
  for (const key of surplus) {
    await deleteObject(key).catch(() => {});
  }
  return result;
}

function fail(refusal: Refusal): ImportResponse {
  return { ok: false, code: refusal.code, message: refusal.message };
}
