import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues, logos } from "@/db/schema";
import { issueVersions } from "@/db/schema-versions";
import {
  ensureCoverFirst,
  issueContentSchema,
  type IssueContent,
} from "@/lib/blocks";
import { imageSites } from "@/lib/image-sites";
import {
  countContent,
  KEEP_VERSIONS,
  versionReason,
  type ContentCounts,
  type VersionReason,
} from "@/lib/issue-versions";
import type { Tx } from "./asset-cleanup";

// Draft version history (aboard #51). Versions are taken by the server inside
// every content write, never asked for by the editor, so an editor opened
// before this shipped keeps them coming. The policy is src/lib/issue-versions.ts.

type LockedIssue = {
  revision: number;
  updatedAt: Date;
  createdAt: Date;
  counts: ContentCounts;
};

// Locks the issue row for the rest of the transaction, so two saves of one
// issue run one after the other: the second sees the first's revision and gets
// its conflict. The counts are taken in SQL so the old document never travels.
async function lockIssue(tx: Tx, id: string): Promise<LockedIssue | null> {
  const [row] = await tx
    .select({
      revision: issues.revision,
      updatedAt: issues.updatedAt,
      createdAt: issues.createdAt,
      pages: sql`jsonb_array_length(${issues.content}->'pages')`.mapWith(
        Number,
      ),
      blocks:
        sql`(select coalesce(sum(jsonb_array_length(p->'blocks')), 0) from jsonb_array_elements(${issues.content}->'pages') p)`.mapWith(
          Number,
        ),
    })
    .from(issues)
    .where(eq(issues.id, id))
    .for("update");
  if (!row) return null;
  return {
    revision: row.revision,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    counts: { pages: row.pages, blocks: row.blocks },
  };
}

// Copies the issue's current pages into a version, server-side (INSERT …
// SELECT), then prunes past KEEP_VERSIONS. Pages already kept — the same
// revision, or identical content (a restore cycle, an undo then redo) — are not
// copied again; an identical version moves up to now instead, so churn can't
// push the older versions out and the pages just seen aren't pruned first.
async function keepCurrent(
  tx: Tx,
  id: string,
  reason: VersionReason,
  counts: ContentCounts,
  now: Date,
): Promise<void> {
  await tx.execute(sql`
    update issue_versions set revision = i.revision, saved_at = i.updated_at,
      created_at = ${now.toISOString()}::timestamptz
    from issues i
    where i.id = ${id} and issue_versions.issue_id = ${id}
      and issue_versions.content = i.content
      and not exists (
        select 1 from issue_versions v where v.issue_id = ${id} and v.revision = i.revision)`);
  await tx.execute(sql`
    insert into ${issueVersions}
      (id, issue_id, content, revision, reason, page_count, block_count, saved_at, created_at)
    select gen_random_uuid()::text, ${issues.id}, ${issues.content}, ${issues.revision},
      ${reason}, ${counts.pages}, ${counts.blocks}, ${issues.updatedAt}, ${now.toISOString()}::timestamptz
    from ${issues} where ${issues.id} = ${id}
      and not exists (
        select 1 from ${issueVersions}
        where ${issueVersions.issueId} = ${id} and ${issueVersions.content} = ${issues.content})
    on conflict (issue_id, revision) do nothing`);
  await tx.execute(sql`
    delete from ${issueVersions}
    where ${issueVersions.issueId} = ${id}
      and ${issueVersions.id} not in (
        select ${issueVersions.id} from ${issueVersions}
        where ${issueVersions.issueId} = ${id}
        order by ${issueVersions.revision} desc
        limit ${KEEP_VERSIONS})`);
}

async function writeContent(tx: Tx, id: string, content: IssueContent) {
  const [row] = await tx
    .update(issues)
    .set({
      content,
      revision: sql`${issues.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, id))
    .returning({ revision: issues.revision });
  return row!.revision;
}

export type ContentSaveResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "missing" };

// Optimistic concurrency: the write only lands if the row is still at the
// revision the caller based its edit on. A stale save (another tab, an
// out-of-order autosave) gets a conflict instead of silently clobbering. Before
// it lands, the pages it replaces may be kept as a version (versionReason).
export async function saveContentKeepingVersions(
  id: string,
  content: IssueContent,
  baseRevision: number,
): Promise<ContentSaveResult> {
  return db.transaction(async (tx) => {
    const issue = await lockIssue(tx, id);
    if (!issue) return { ok: false, reason: "missing" };
    if (issue.revision !== baseRevision)
      return { ok: false, reason: "conflict" };

    const [newest] = await tx
      .select({
        revision: issueVersions.revision,
        createdAt: issueVersions.createdAt,
        reason: issueVersions.reason,
        pages: issueVersions.pageCount,
        blocks: issueVersions.blockCount,
      })
      .from(issueVersions)
      .where(eq(issueVersions.issueId, id))
      .orderBy(desc(issueVersions.revision))
      .limit(1);
    const now = new Date();
    const reason = versionReason({
      now,
      lastSavedAt: issue.updatedAt,
      newestVersionAt: newest?.createdAt ?? null,
      newestReason: newest?.reason ?? null,
      newestCounts: newest
        ? { pages: newest.pages, blocks: newest.blocks }
        : null,
      issueCreatedAt: issue.createdAt,
      revisionKept: newest?.revision === issue.revision,
      before: issue.counts,
      after: countContent(content),
    });
    if (reason) await keepCurrent(tx, id, reason, issue.counts, now);

    return { ok: true, revision: await writeContent(tx, id, content) };
  });
}

export type VersionSummary = {
  id: string;
  revision: number;
  reason: VersionReason;
  pageCount: number;
  blockCount: number;
  savedAt: Date;
};

const SUMMARY = {
  id: issueVersions.id,
  revision: issueVersions.revision,
  reason: issueVersions.reason,
  pageCount: issueVersions.pageCount,
  blockCount: issueVersions.blockCount,
  savedAt: issueVersions.savedAt,
};

/** An issue's versions, newest first, without their content. */
export async function listVersions(issueId: string): Promise<VersionSummary[]> {
  return db
    .select(SUMMARY)
    .from(issueVersions)
    .where(eq(issueVersions.issueId, issueId))
    .orderBy(desc(issueVersions.revision));
}

/** One version with its pages read into the current content model, or null
 *  (also when a stored document no longer parses). */
export async function getVersion(
  issueId: string,
  versionId: string,
): Promise<(VersionSummary & { content: IssueContent }) | null> {
  const [row] = await db
    .select({ ...SUMMARY, content: issueVersions.content })
    .from(issueVersions)
    .where(
      and(eq(issueVersions.issueId, issueId), eq(issueVersions.id, versionId)),
    )
    .limit(1);
  if (!row) return null;
  const parsed = issueContentSchema.safeParse(row.content);
  if (!parsed.success) return null;
  return {
    ...row,
    content: { ...parsed.data, pages: ensureCoverFirst(parsed.data.pages) },
  };
}

export type RestoreResult =
  | { ok: true; revision: number; unlinkedLogos: number }
  | { ok: false; reason: "conflict" | "missing" | "invalid" };

// Puts a version's pages back as an ordinary content write: the revision bumps,
// so a stale tab gets its conflict and the PDF cache re-keys. The pages it
// replaces are kept first ("before-restore"), so a restore can itself be undone
// from History. Title, theme and the footer mark are left as they are.
//
// A cover logo whose library entry was deleted since is unlinked: its artwork
// is an ordinary image now (the reference scan kept it), as issue transfer does.
export async function restoreVersion(
  issueId: string,
  versionId: string,
  baseRevision: number,
): Promise<RestoreResult> {
  return db.transaction(async (tx) => {
    const issue = await lockIssue(tx, issueId);
    if (!issue) return { ok: false, reason: "missing" };
    if (issue.revision !== baseRevision)
      return { ok: false, reason: "conflict" };

    const [version] = await tx
      .select({ content: issueVersions.content })
      .from(issueVersions)
      .where(
        and(
          eq(issueVersions.issueId, issueId),
          eq(issueVersions.id, versionId),
        ),
      )
      .limit(1);
    if (!version) return { ok: false, reason: "missing" };
    const parsed = issueContentSchema.safeParse(version.content);
    if (!parsed.success) return { ok: false, reason: "invalid" };
    const content = {
      ...parsed.data,
      pages: ensureCoverFirst(parsed.data.pages),
    };
    const unlinkedLogos = await unlinkMissingLogos(tx, content);

    await keepCurrent(tx, issueId, "before-restore", issue.counts, new Date());
    return {
      ok: true,
      revision: await writeContent(tx, issueId, content),
      unlinkedLogos,
    };
  });
}

async function unlinkMissingLogos(
  tx: Tx,
  content: IssueContent,
): Promise<number> {
  const elements = [...imageSites(content)].flatMap((site) =>
    site.kind === "coverLogo" && site.element.logoId ? [site.element] : [],
  );
  if (elements.length === 0) return 0;
  const ids = [...new Set(elements.map((e) => e.logoId!))];
  const found = await tx
    .select({ id: logos.id })
    .from(logos)
    .where(inArray(logos.id, ids));
  const present = new Set(found.map((row) => row.id));
  let unlinked = 0;
  for (const element of elements) {
    if (present.has(element.logoId!)) continue;
    delete element.logoId;
    unlinked += 1;
  }
  return unlinked;
}
