import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { emptyIssueContent, type IssueContent } from "@/lib/blocks";
import type { FooterReserve } from "@/lib/branding";

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

// The issue's pages will be laid out against the footer that is set right now,
// so that is the reserve the new row records (issue #128). Passed in rather than
// read here: this module is data access, and the DB → env → default resolution
// belongs to server/settings.ts alone.
export async function createIssue(reserve: FooterReserve) {
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
          footerMarkSize: reserve.footerMarkSize,
          footerTextSize: reserve.footerTextSize,
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

// Explicit column list — never spread caller input into a SET clause. Drizzle
// drops undefined values from the SET, so an omitted field is left alone; a
// `logoId: null` is a real write (the admin chose "no logo").
export async function updateIssueMeta(
  id: string,
  meta: { title?: string; theme?: string; logoId?: string | null },
) {
  await db
    .update(issues)
    .set({
      title: meta.title,
      theme: meta.theme,
      logoId: meta.logoId,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, id));
}

// Adopt a new footer reserve for one issue (issue #128) — the write behind the
// editor's "use the magazine's current footer" action. Deliberately its own
// function rather than a field on updateIssueMeta: the only value it is ever
// given is the footer that is set right now (the caller reads it server-side),
// so an issue's reserve can only ever become the live setting, never an
// arbitrary one an editor client asked for.
//
// No `revision` bump: this changes no content. The PDF cache re-keys on it
// anyway, because the clamped footer feeds the chrome fingerprint.
export async function updateIssueFooterReserve(
  id: string,
  reserve: FooterReserve,
) {
  await db
    .update(issues)
    .set({
      footerMarkSize: reserve.footerMarkSize,
      footerTextSize: reserve.footerTextSize,
      updatedAt: new Date(),
    })
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
