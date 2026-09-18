import "server-only";
import { inArray, sql } from "drizzle-orm";
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
  type ImportState,
} from "./operations";
import { verifyBundle, type VerifiedBundle } from "./verify";

// Validate, claim the operation, write the objects, then one transaction for
// every row (docs/issue-transfer.md#the-operation-record). Nothing here depends
// on the client still being connected, or on the progress callback returning.

// Transaction-scoped, so two imports cannot both decide to create "Acme" and the
// lock can never be left held.
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
  // The callback writes to a response stream that may already have been
  // cancelled; an import must not fail because nobody is listening.
  const phase = (at: ImportPhase) => {
    try {
      input.onPhase?.(at);
    } catch {
      // the client has gone
    }
  };
  phase("checking");

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
    return await runImport(input, opened.archive, phase);
  } finally {
    await opened.archive.close().catch(() => {});
  }
}

async function runImport(
  input: ImportInput,
  archive: BundleArchive,
  phase: (at: ImportPhase) => void,
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
  if (claim.state !== "started") return answer(claim);

  phase("importing");
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
    const cleanup = await abandonImport(input.operationId, input.adminId);
    // The commit landed and only its acknowledgement was lost: the rows are
    // real, the objects are the ones they point at, and this is the answer.
    if (cleanup.outcome === "committed") {
      return { ok: true, result: cleanup.result, retried: true };
    }
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

/** What a known operation id is worth, in the shape the modal reads. */
export function answer(state: ImportState): ImportResponse {
  switch (state.state) {
    case "committed":
      return { ok: true, result: state.result, retried: true };
    case "running":
      return fail(
        refuse(
          "still-running",
          "This import is still going. Give it a moment, then try again.",
        ),
      );
    case "abandoned":
      return fail(
        refuse(
          "abandoned",
          "That import didn’t finish. Close this and choose the file again.",
        ),
      );
    case "not-yours":
      return fail(
        refuse(
          "not-yours",
          "Another administrator started that import. Close this and choose the file again.",
        ),
      );
    case "unknown":
      return fail(
        refuse("unknown-operation", "There is no record of that import."),
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
    // After the first one, so the gate can fail an import partway through.
    if (written.size > 0) throwIfInjected("objects");
    // `reread`: these entries were matched against their declared size and hash
    // during verification, so they must not spend the zip-bomb budget twice.
    const bytes = await archive.reread(
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

// Resolves a second time under the advisory lock, because the first pass ran
// unlocked and another import may have created the same sponsor in between.
// Adapting is what makes two concurrent imports create each entry once; the one
// thing it cannot adapt to is a row disappearing, whose bytes never arrived.
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

    // images.issueId → issues.id → logos.id → logos.imageId → images.id is a
    // cycle, so the rows go in dependency order and the images adopt their issue
    // afterwards. Batched: this transaction holds the global import lock.
    for (const batch of chunk(bundle.images, INSERT_BATCH)) {
      await tx.insert(images).values(
        batch.map((image) => ({
          id: image.id,
          key: importObjectKey(input.operationId, image.id),
          width: sizes.get(image.bundleId)!.width,
          height: sizes.get(image.bundleId)!.height,
          issueId: null,
        })),
      );
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
    for (const batch of chunk(bundle.issues, INSERT_BATCH)) {
      await tx.insert(issues).values(
        batch.map((issue) => ({
          id: issue.id,
          title: issue.title,
          theme: issue.theme,
          status: "draft" as const,
          content: issue.content,
          footerMarkSize: issue.footerMarkSize,
          footerTextSize: issue.footerTextSize,
          logoId: issue.logoId,
        })),
      );
    }
    const owned = new Map<string, string[]>();
    for (const image of bundle.images) {
      if (!image.issueId) continue;
      owned.set(image.issueId, [...(owned.get(image.issueId) ?? []), image.id]);
    }
    for (const [issueId, imageIds] of owned) {
      await tx
        .update(images)
        .set({ issueId })
        .where(inArray(images.id, imageIds));
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

  // The rows are in. A failure from here is the lost-acknowledgement case the
  // caller's cleanup has to recognise rather than undo.
  throwIfInjected("post-commit");

  // Committed. An object the first pass uploaded for a library entry the second
  // pass found already there belongs to nothing — best-effort, like every other
  // post-commit sweep (server/asset-cleanup.ts).
  for (const key of surplus) {
    await deleteObject(key).catch(() => {});
  }
  return result;
}

// Postgres caps a statement's parameters at 65535; a few hundred rows of a
// handful of columns each is comfortably inside it and one round trip.
const INSERT_BATCH = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let at = 0; at < items.length; at += size) {
    batches.push(items.slice(at, at + size));
  }
  return batches;
}

function fail(refusal: Refusal): ImportResponse {
  return { ok: false, code: refusal.code, message: refusal.message };
}
