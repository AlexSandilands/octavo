import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { issueImports } from "@/db/schema";
import type { ImportResult } from "@/lib/issue-transfer/result";
import { deleteByPrefix } from "@/lib/storage";
import { throwIfInjected } from "./fault";
import { report } from "./report";

// The durable record of an import attempt, and the recovery built on it
// (docs/issue-transfer.md#the-operation-record).

/** Where every object one import writes lives. The prefix is the key list. */
export function importPrefix(operationId: string): string {
  return `imports/${operationId}/`;
}

export function importObjectKey(operationId: string, imageId: string): string {
  return `${importPrefix(operationId)}${imageId}.webp`;
}

export type ImportState =
  | { state: "unknown" }
  | { state: "running" }
  | { state: "committed"; result: ImportResult }
  | { state: "abandoned" }
  | { state: "not-yours" };

/** What this admin's operation id is currently worth. */
export async function readImport(
  operationId: string,
  adminId: string,
): Promise<ImportState> {
  const [row] = await db
    .select({
      adminId: issueImports.adminId,
      status: issueImports.status,
      result: issueImports.result,
    })
    .from(issueImports)
    .where(eq(issueImports.id, operationId))
    .limit(1);
  if (!row) return { state: "unknown" };
  if (row.adminId !== adminId) return { state: "not-yours" };
  if (row.status === "committed" && row.result) {
    return { state: "committed", result: row.result };
  }
  return { state: row.status === "started" ? "running" : "abandoned" };
}

export type BeginResult = { state: "started" } | ImportState;

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
  return row ? { state: "started" } : readImport(operationId, adminId);
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

export type AbandonOutcome =
  | { outcome: "swept" }
  | { outcome: "stranded" }
  | { outcome: "committed"; result: ImportResult };

/**
 * Cleanup after a failed attempt. The status is read first and only a row still
 * `started` may have its prefix deleted: a commit whose acknowledgement was lost
 * also lands here, and its objects are exactly the ones the new rows point at.
 * If storage refuses, the row stays `started` so the sweep comes back to it —
 * the one case where cleanup is eventual rather than immediate.
 */
export async function abandonImport(
  operationId: string,
  adminId: string,
): Promise<AbandonOutcome> {
  const current = await readImport(operationId, adminId);
  if (current.state === "committed") {
    return { outcome: "committed", result: current.result };
  }
  try {
    throwIfInjected("cleanup");
    await deleteByPrefix(importPrefix(operationId));
  } catch (err) {
    report(err, { stage: "cleanup", operationId });
    return { outcome: "stranded" };
  }
  await db
    .update(issueImports)
    .set({ status: "swept", updatedAt: new Date() })
    .where(
      and(eq(issueImports.id, operationId), eq(issueImports.status, "started")),
    );
  return { outcome: "swept" };
}

// Comfortably longer than any import, so the sweep can never catch one running
// on another instance.
const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** Delete the objects of every abandoned attempt. Never throws: it is recovery,
 *  and a storage outage here must not stop the import that called it. */
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
