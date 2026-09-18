import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { issueImports } from "@/db/schema";
import type { ImportResult } from "@/lib/issue-transfer/result";
import { deleteByPrefix } from "@/lib/storage";
import { throwIfInjected } from "./fault";
import { report } from "./report";

// The durable record of an import attempt (issue #293). It exists for two
// things nothing else in the app needs:
//
//   - telling a **retry** after a lost response apart from a deliberate second
//     import. The modal mints the operation id; the same id back means "what
//     happened?", never a second set of drafts.
//   - **recovery**. Every object an import writes goes under `imports/<id>/`,
//     so the prefix is the record of its intended keys. A failure deletes it at
//     once; if even that fails the row stays `started` and the next import (or
//     the next server start) deletes the prefix and marks it `swept`.

/** Where every object one import writes lives. The prefix IS the key list. */
export function importPrefix(operationId: string): string {
  return `imports/${operationId}/`;
}

export function importObjectKey(operationId: string, imageId: string): string {
  return `${importPrefix(operationId)}${imageId}.webp`;
}

export type BeginResult =
  | { state: "started" }
  | { state: "running" }
  | { state: "committed"; result: ImportResult }
  | { state: "abandoned" };

/** Claim the operation id, or report what the last attempt under it did. */
export async function beginImport(
  operationId: string,
  adminId: string,
): Promise<BeginResult> {
  const [row] = await db
    .insert(issueImports)
    .values({ id: operationId, adminId, status: "started" })
    .onConflictDoNothing()
    .returning({ id: issueImports.id });
  if (row) return { state: "started" };

  const [existing] = await db
    .select({ status: issueImports.status, result: issueImports.result })
    .from(issueImports)
    .where(eq(issueImports.id, operationId))
    .limit(1);
  if (existing?.status === "committed" && existing.result) {
    return { state: "committed", result: existing.result };
  }
  return { state: existing?.status === "started" ? "running" : "abandoned" };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Marked in the same transaction as the rows, so an import is committed
 *  exactly when its drafts are. */
export async function markCommitted(
  tx: Tx,
  operationId: string,
  result: ImportResult,
): Promise<void> {
  await tx
    .update(issueImports)
    .set({ status: "committed", result, updatedAt: new Date() })
    .where(eq(issueImports.id, operationId));
}

/**
 * Immediate cleanup after a failure: remove everything the attempt wrote and
 * close the record. If storage refuses, the row is deliberately left `started`
 * so the sweep comes back to it — the one case where cleanup is eventual.
 */
export async function abandonImport(operationId: string): Promise<void> {
  try {
    throwIfInjected("cleanup");
    await deleteByPrefix(importPrefix(operationId));
  } catch (err) {
    report(err, { stage: "cleanup", operationId });
    return;
  }
  await db
    .update(issueImports)
    .set({ status: "swept", updatedAt: new Date() })
    .where(
      and(eq(issueImports.id, operationId), eq(issueImports.status, "started")),
    );
}

/** An attempt still `started` this long after it began did not survive to
 *  finish. Comfortably longer than any import, so it can never catch one
 *  running on another instance. */
const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/**
 * Delete the objects of every abandoned attempt. Runs at the start of each
 * import and once at server start — deploys are frequent enough that nothing
 * lingers, and it introduces no scheduler. Never throws: it is recovery, and a
 * storage outage here must not stop the import that called it.
 */
export async function sweepAbandonedImports(): Promise<number> {
  let swept = 0;
  try {
    const stale = await db
      .select({ id: issueImports.id })
      .from(issueImports)
      .where(
        and(
          eq(issueImports.status, "started"),
          lt(issueImports.createdAt, new Date(Date.now() - ABANDONED_AFTER_MS)),
        ),
      );
    for (const row of stale) {
      await deleteByPrefix(importPrefix(row.id));
      await db
        .update(issueImports)
        .set({ status: "swept", updatedAt: new Date() })
        .where(
          and(eq(issueImports.id, row.id), eq(issueImports.status, "started")),
        );
      swept += 1;
    }
  } catch (err) {
    report(err, { stage: "sweep" });
  }
  return swept;
}
