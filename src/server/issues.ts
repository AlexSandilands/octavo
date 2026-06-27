import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { emptyIssueContent, type IssueContent } from "@/lib/blocks";

// Server-only data access for issues. All callers (server components, server
// actions) go through here — never query Drizzle from a component.

export async function listIssues() {
  return db.select().from(issues).orderBy(desc(issues.number));
}

export async function getIssue(id: string) {
  const [row] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  return row ?? null;
}

export async function getPublishedIssueByNumber(number: number) {
  const [row] = await db
    .select()
    .from(issues)
    .where(eq(issues.number, number))
    .limit(1);
  return row ?? null;
}

export async function createIssue() {
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${issues.number}), 0)` })
    .from(issues);
  const [row] = await db
    .insert(issues)
    .values({
      number: (max ?? 0) + 1,
      title: "Untitled draft",
      theme: "classic",
      status: "draft",
      content: emptyIssueContent(),
    })
    .returning();
  if (!row) throw new Error("Failed to create issue");
  return row;
}

export async function updateIssueContent(id: string, content: IssueContent) {
  await db
    .update(issues)
    .set({ content, updatedAt: new Date() })
    .where(eq(issues.id, id));
}

export async function updateIssueMeta(
  id: string,
  meta: { title?: string; theme?: string },
) {
  await db
    .update(issues)
    .set({ ...meta, updatedAt: new Date() })
    .where(eq(issues.id, id));
}

export async function publishIssue(id: string) {
  await db
    .update(issues)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(issues.id, id));
}

export async function deleteIssue(id: string) {
  await db.delete(issues).where(eq(issues.id, id));
}
