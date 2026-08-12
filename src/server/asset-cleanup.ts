import "server-only";
import * as Sentry from "@sentry/nextjs";
import { inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { images, issues, logos, sponsors } from "@/db/schema";
import { collectImageIds } from "@/lib/images";
import { deleteByPrefix, deleteObject, usingLocalStorage } from "@/lib/storage";

// Asset lifecycle (issue #84). Nothing in the app used to delete a stored
// object, so every image a deleted issue or sponsor left behind stayed in the
// bucket forever with no row naming it. Deleting one now takes its images with
// it — but only the ones nothing else still shows.
//
// The ordering the delete paths follow, and why it is this way round:
//   1. ONE transaction removes the owning row and, in the same snapshot, works
//      out which of its images are now unreferenced and deletes those rows;
//   2. only once that transaction has COMMITTED is storage touched.
// A crash in between leaks objects — bytes with no row, costing fractions of a
// cent a month and visible to nobody. The other order risks the opposite:
// bytes deleted and then the transaction rolled back, leaving a live issue with
// holes in its pages. So storage cleanup goes last, is best-effort, and never
// throws back into the delete.

// The handle drizzle hands a transaction body. The functions here take one
// rather than `db` on purpose: a reference scan is only trustworthy inside the
// same transaction that removed the row it is scanning on behalf of.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Every image id that anything in the database still points at. Three places
// can hold a reference and all three are here — an image reachable from any one
// of them is in use:
//   - an issue's `content` block tree: image blocks, montage slides and video
//     poster frames, which `collectImageIds` is the single traversal for (the
//     same one that feeds the renderers, so a block type that references an
//     image is either in both or in neither);
//   - `sponsors.logoId`;
//   - `logos.imageId`, the club's own marks (issue #92). This is the entry that
//     must never be forgotten: `logos.imageId` CASCADEs, so deleting a mark's
//     image would take the logo row with it and blank the running footer of
//     every issue that had picked it.
// `issues.logoId` needs no entry of its own — it names a logo, covered above.
//
// Deliberately a scan rather than a mirrored reference-count table: a count
// that drifts deletes an image somebody is still looking at, while this cannot
// be wrong about the snapshot it reads. Deleting is a rare admin action over an
// archive of tens of issues, so reading every content document once costs
// nothing measurable. Exported so a future edit-time sweep reuses this
// definition of "referenced" rather than growing a second one.
//
// Call it INSIDE the delete transaction and AFTER the owning row is gone, so
// what it returns is exactly "everything that survives".
export async function collectReferencedImageIds(tx: Tx): Promise<Set<string>> {
  const referenced = new Set<string>();

  // Sequential, not Promise.all: a transaction owns one connection.
  const documents = await tx.select({ content: issues.content }).from(issues);
  for (const row of documents) {
    for (const id of collectImageIds(row.content)) referenced.add(id);
  }

  const sponsorLogos = await tx
    .select({ logoId: sponsors.logoId })
    .from(sponsors)
    .where(isNotNull(sponsors.logoId));
  for (const row of sponsorLogos) {
    if (row.logoId) referenced.add(row.logoId);
  }

  const marks = await tx.select({ imageId: logos.imageId }).from(logos);
  for (const row of marks) referenced.add(row.imageId);

  return referenced;
}

// Of `candidateIds`, delete the rows nothing references any more and hand back
// their storage keys for the caller to sweep after the commit. Candidates are
// whatever the row being deleted was holding; whether one survives is decided
// solely by the scan above — never by which issue an image was uploaded under,
// since an image uploaded while editing one issue can end up placed in another.
export async function takeOrphanedImages(
  tx: Tx,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const referenced = await collectReferencedImageIds(tx);
  const orphans = candidateIds.filter((id) => !referenced.has(id));
  if (orphans.length === 0) return [];
  const rows = await tx
    .delete(images)
    .where(inArray(images.id, orphans))
    .returning({ key: images.key });
  return rows.map((row) => row.key);
}

// Best-effort storage cleanup, run only once the transaction has committed.
// Never throws: the rows are already gone, so a failure here changes nothing a
// member can see — it leaves objects in the bucket that nothing points at. That
// is invisible in the app, which makes this capture the only record of it, the
// way the upload route's is the only record of a failed put.
//
// Each target is attempted on its own so one unreachable key can't strand the
// rest, and the whole batch is reported as a single capture rather than one
// alert per object.
export async function sweepOrphanedObjects(target: {
  keys: string[];
  prefixes?: string[];
  context: Record<string, unknown>;
}): Promise<void> {
  const failures: { target: string; err: unknown }[] = [];

  for (const key of target.keys) {
    try {
      await deleteObject(key);
    } catch (err) {
      failures.push({ target: key, err });
    }
  }
  for (const prefix of target.prefixes ?? []) {
    try {
      await deleteByPrefix(prefix);
    } catch (err) {
      failures.push({ target: prefix, err });
    }
  }

  if (failures.length === 0) return;
  try {
    console.error("Storage cleanup failed after delete", failures);
    Sentry.captureException(failures[0]!.err, {
      tags: { stage: "asset-cleanup" },
      extra: {
        ...target.context,
        failed: failures.map((failure) => failure.target),
        failureCount: failures.length,
        localStorage: usingLocalStorage(),
      },
    });
  } catch (err) {
    // Reporting a leak must not become a second failure: the rows are gone and
    // the caller has already returned its result to the admin, so an error
    // escaping from here would surface as "delete failed" for something that
    // demonstrably succeeded.
    console.error("Could not report the failed storage cleanup", err);
  }
}
