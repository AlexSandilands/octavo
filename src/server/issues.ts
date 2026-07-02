import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { emptyIssueContent, type IssueContent } from "@/lib/blocks";

// Server-only data access for issues. All callers (server components, server
// actions) go through here — never query Drizzle from a component.

export async function listIssues() {
  return db.select().from(issues).orderBy(desc(issues.number));
}

export async function getIssue(id: string) {
  const [row] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  return row ?? null;
}

// Reader lookup — published issues only. Drafts are reachable solely through
// the admin editor and its preview route (by internal id, via getIssue).
export async function getPublishedIssueByNumber(number: number) {
  const [row] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.number, number), eq(issues.status, "published")))
    .limit(1);
  return row ?? null;
}

// True for Postgres unique-constraint violations (SQLSTATE 23505).
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

export async function createIssue() {
  // Allocate `number` inside the INSERT itself so two concurrent creates can't
  // both read the same max. The unique constraint is the backstop; if we still
  // lose that race, retry with a freshly computed number.
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(issues)
        .values({
          number: sql`coalesce((select max(${issues.number}) from ${issues}), 0) + 1`,
          title: "Untitled draft",
          theme: "classic",
          status: "draft",
          content: emptyIssueContent(),
        })
        .returning();
      if (!row) throw new Error("Failed to create issue");
      return row;
    } catch (err) {
      if (attempt >= 2 || !isUniqueViolation(err)) throw err;
    }
  }
}

export type ContentSaveResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "missing" };

// Optimistic concurrency: the write only lands if the row is still at the
// revision the caller based its edit on. A stale save (another tab, an
// out-of-order autosave) gets a conflict instead of silently clobbering.
export async function updateIssueContent(
  id: string,
  content: IssueContent,
  baseRevision: number,
): Promise<ContentSaveResult> {
  const [row] = await db
    .update(issues)
    .set({
      content,
      revision: sql`${issues.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(issues.id, id), eq(issues.revision, baseRevision)))
    .returning({ revision: issues.revision });
  if (row) return { ok: true, revision: row.revision };

  const exists = await getIssue(id);
  return { ok: false, reason: exists ? "conflict" : "missing" };
}

// Explicit column list — never spread caller input into a SET clause.
export async function updateIssueMeta(
  id: string,
  meta: { title?: string; theme?: string },
) {
  await db
    .update(issues)
    .set({ title: meta.title, theme: meta.theme, updatedAt: new Date() })
    .where(eq(issues.id, id));
}

export async function publishIssue(id: string) {
  await db
    .update(issues)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(issues.id, id));
}

export async function deleteIssue(id: string) {
  await db.delete(issues).where(eq(issues.id, id));
}
