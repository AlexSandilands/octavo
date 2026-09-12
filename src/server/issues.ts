import "server-only";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  max,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { images, issues } from "@/db/schema";
import { emptyIssueContent, type IssueContent } from "@/lib/blocks";
import type { FooterReserve } from "@/lib/branding";
import { isUniqueViolation } from "@/lib/db-errors";
import { collectImageIds } from "@/lib/images";
import { ISSUE_NUMBER_MAX } from "@/lib/issue-number";
import { likePattern } from "@/lib/like-pattern";
import {
  ADMIN_LIST_PAGE_SIZE,
  pageBounds,
  type PagedList,
} from "@/lib/pagination";
import { sweepOrphanedObjects, takeOrphanedImages } from "./asset-cleanup";

// Server-only data access for issues. All callers (server components, server
// actions) go through here — never query Drizzle from a component.

export type IssueRow = typeof issues.$inferSelect;
export type IssueStatus = IssueRow["status"];

/** A published issue. Its number was allocated at publish and a database check
 *  constraint holds it non-null, which the inferred row type can't say. */
export type PublishedIssueRow = IssueRow & { number: number };

/** Narrows the rows of a published-only query. Nothing can be dropped — the
 *  check constraint makes a numberless published row impossible. */
export function isNumbered(row: IssueRow): row is PublishedIssueRow {
  return row.number !== null;
}

export type IssueList = PagedList<IssueRow> & {
  /** Whole-list numbers for the summary line, independent of the search. */
  total: number;
  draftTotal: number;
};

// The status filter the dashboard offers beside the search. Like the search it
// runs in the database, because the list only serves one page.
export type IssueFilter = "all" | "draft" | "published";

const FILTER_CONDITIONS = {
  all: undefined,
  draft: eq(issues.status, "draft"),
  published: eq(issues.status, "published"),
} as const;

// Which year an issue belongs to, decided once. Postgres and Node run in
// different session timezones, so a bare `extract(year …)` can put an issue in
// a year the shelf's own headings (JS getFullYear) disagree with; every year
// this module (and library.ts, which shares it) computes is taken in Node's
// zone instead.
const APP_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const publishedYear = sql`extract(year from ${issues.publishedAt} at time zone ${APP_TZ})`;

// The WHERE for a search + status + year, shared by every query below so
// "matching" can never mean two different things. A year narrows on publication
// date, so it never matches a draft — which is what filtering by "when it was
// published" means.
function issueWhere(query: string, filter: IssueFilter, year: number | null) {
  const conditions = [
    query ? ilike(issues.title, likePattern(query)) : undefined,
    FILTER_CONDITIONS[filter],
    year !== null ? sql`${publishedYear} = ${year}` : undefined,
  ].filter((c) => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export type IssueListOptions = {
  query?: string;
  page?: number;
  filter?: IssueFilter;
  /** null = every year. */
  year?: number | null;
};

// The dashboard's order (issue #270): work in progress first, most recently
// edited at the top, then the published run by number descending. Drafts have
// no number to sort by, and an author's unfinished issue is what they came for.
// `id` last makes it a total order, which is what keeps plain offset paging
// safe now that `number` alone no longer is.
const DASHBOARD_ORDER = [
  sql`${issues.status} = 'draft' desc`,
  sql`case when ${issues.status} = 'draft' then ${issues.updatedAt} end desc`,
  desc(issues.number),
  issues.id,
];

// The dashboard list, paged. The counts and the rows share one read-only
// REPEATABLE READ snapshot, so neither the clamp nor the summary can disagree
// with the rows served. The search and filters run in the database so they see
// every issue, not just the served page; an out-of-range page is clamped rather
// than 404ed, so the URL an admin held while rows were being deleted still
// lands on the nearest real page.
export async function listIssuesPage(
  opts: IssueListOptions = {},
): Promise<IssueList> {
  const query = opts.query?.trim() ?? "";
  const where = issueWhere(query, opts.filter ?? "all", opts.year ?? null);

  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({
          total: count(),
          draftTotal:
            sql`count(*) filter (where ${eq(issues.status, "draft")})`.mapWith(
              Number,
            ),
          matching: where
            ? sql`count(*) filter (where ${where})`.mapWith(Number)
            : count(),
        })
        .from(issues);
      const matching = counts?.matching ?? 0;
      const bounds = pageBounds(matching, ADMIN_LIST_PAGE_SIZE, opts.page);

      const rows = await tx
        .select()
        .from(issues)
        .where(where)
        .orderBy(...DASHBOARD_ORDER)
        .limit(ADMIN_LIST_PAGE_SIZE)
        .offset(bounds.offset);

      return {
        rows,
        page: bounds.page,
        pageCount: bounds.pageCount,
        matching,
        total: counts?.total ?? 0,
        draftTotal: counts?.draftTotal ?? 0,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Every issue matching a search + filters — the bulk bar's "Select all N
// matching". Fetched on demand when the admin asks for it, not shipped with
// every page render.
//
// `limit` is required rather than optional, because these ids go straight back
// up as the bulk delete's argument and that argument has a size the wire will
// carry (see features/admin/selection-limit). The order is listIssuesPage's, so
// a bounded answer is the top of the list the admin is looking at. The status
// rides along so the confirmation can say how many of the selection are
// published without a second round trip.
export async function listMatchingIssues(
  opts: IssueListOptions & { limit: number },
): Promise<{ id: string; status: IssueStatus }[]> {
  const query = opts.query?.trim() ?? "";
  const where = issueWhere(query, opts.filter ?? "all", opts.year ?? null);
  return db
    .select({ id: issues.id, status: issues.status })
    .from(issues)
    .where(where)
    .orderBy(...DASHBOARD_ORDER)
    .limit(opts.limit);
}

// The years the date filter offers: only those that actually have a published
// issue, newest first. Drafts have no publication date and so no year.
export async function listIssueYears(): Promise<number[]> {
  // Sorted here, not in SQL: the timezone rides in as a bind parameter, and
  // SELECT DISTINCT rejects an ORDER BY whose copy of it is a second parameter.
  // One row per year, so the sort is free.
  const rows = await db
    .selectDistinct({ year: publishedYear })
    .from(issues)
    .where(isNotNull(issues.publishedAt));
  return rows.map((r) => Number(r.year)).sort((a, b) => b - a);
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
export async function getPublishedIssueByNumber(
  number: number,
): Promise<PublishedIssueRow | null> {
  const [row] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.number, number), eq(issues.status, "published")))
    .limit(1);
  // The number is what was matched on, so re-stating it narrows the row type
  // without a cast.
  return row ? { ...row, number } : null;
}

/** The number the publish modal proposes: the next after the highest published
 *  one (issue #270). A deleted top issue frees its number, so it comes back. */
export async function nextIssueNumber(): Promise<number> {
  const [row] = await db
    .select({ highest: max(issues.number) })
    .from(issues)
    .where(eq(issues.status, "published"));
  return Math.min((row?.highest ?? 0) + 1, ISSUE_NUMBER_MAX);
}

// The issue's pages will be laid out against the footer that is set right now,
// so that is the reserve the new row records (issue #128). Passed in rather than
// read here: this module is data access, and the DB → env → default resolution
// belongs to server/settings.ts alone.
export async function createIssue(reserve: FooterReserve) {
  // No `number`: a draft has none (issue #270), so a magazine that throws away
  // a dozen drafts still publishes its first edition as No. 1.
  const [row] = await db
    .insert(issues)
    .values({
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

export type PublishOutcome =
  | { ok: true; number: number }
  | { ok: false; reason: "taken" | "missing" };

// Publish an issue under `number` (issue #270). One statement, so the number a
// live issue already carries is never disturbed even if two requests race: the
// CASE only writes on a draft, which is what keeps shared and emailed links
// good. Uniqueness among published issues belongs to the partial unique index —
// checking first would only narrow the race, not close it — so a number taken
// since the modal proposed it comes back as "taken", not a 500.
export async function publishIssue(
  id: string,
  number: number,
): Promise<PublishOutcome> {
  try {
    const [row] = await db
      .update(issues)
      .set({
        number: sql`case when ${issues.status} = 'draft' then ${number}::integer else ${issues.number} end`,
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id))
      .returning({ number: issues.number });
    if (!row?.number) return { ok: false, reason: "missing" };
    return { ok: true, number: row.number };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "taken" };
    throw err;
  }
}

export type DeleteIssuesResult = {
  deleted: number;
  /** How many of the deleted issues members could read (for the report). */
  publishedDeleted: number;
  /** Ids that were already gone (a stale list). */
  missing: number;
};

// Deleting an issue takes its now-orphaned images with it (issue #84) — the
// photographs, montage slides and video poster frames that were only ever on
// these pages, plus anything uploaded while editing it that never made it onto
// a page. This is the last moment either is identifiable: `images.issueId` is
// set to null by the foreign key as the issue row goes, so an image nobody
// placed would afterwards be indistinguishable from a stray upload.
//
// Which of those candidates actually go is decided by the reference scan, not
// by `images.issueId` — that column records which issue an image was uploaded
// *under*, and an image uploaded under one issue can be placed in another, in a
// sponsor's logo, or be a club mark. See server/asset-cleanup.ts.
//
// The scan runs inside this transaction, after the issue row is gone, so it
// reads one consistent picture of what survives. The residual race, honestly:
// at READ COMMITTED another admin's autosave could commit a new reference to a
// candidate image in the moment between the scan and this commit, and we would
// delete an image that issue now shows. Closing it means SERIALIZABLE and
// aborting one of the two transactions — usually the author's autosave, which
// is a poor trade for a window of milliseconds between two admins doing rare
// things at once. The damage if it ever lands is one missing picture on one
// page, which re-uploading fixes; the delete itself is never wrong.
// A batch is one transaction and one reference scan rather than a loop of
// single deletes: every row goes first, then the scan decides what survives, so
// an image two of the deleted issues shared is judged once against the world
// that is left. Storage is swept once afterwards, for the same reason it is
// swept last at all.
export async function deleteIssues(ids: string[]): Promise<DeleteIssuesResult> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return { deleted: 0, publishedDeleted: 0, missing: 0 };
  }

  const { orphanedKeys, found } = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: issues.id,
        status: issues.status,
        content: issues.content,
      })
      .from(issues)
      .where(inArray(issues.id, unique));
    if (rows.length === 0) return { orphanedKeys: [], found: rows };

    const doomed = rows.map((row) => row.id);
    const uploaded = await tx
      .select({ id: images.id })
      .from(images)
      .where(inArray(images.issueId, doomed));
    const candidates = [
      ...new Set([
        ...rows.flatMap((row) => collectImageIds(row.content)),
        ...uploaded.map((row) => row.id),
      ]),
    ];

    await tx.delete(issues).where(inArray(issues.id, doomed));
    return {
      orphanedKeys: await takeOrphanedImages(tx, candidates),
      found: rows,
    };
  });

  // Committed. Everything from here is best-effort and cannot undo the delete.
  await sweepOrphanedObjects({
    keys: orphanedKeys,
    // The cached PDFs. Derived bytes under one folder per issue, keyed by a
    // revision, theme and fingerprint that nothing records once the row is gone
    // (see the key built in /api/issues/[number]/pdf), so they go by prefix.
    prefixes: found.map((row) => `pdfs/${row.id}/`),
    context: { issueIds: found.map((row) => row.id) },
  });

  return {
    deleted: found.length,
    publishedDeleted: found.filter((row) => row.status === "published").length,
    missing: unique.length - found.length,
  };
}

export async function deleteIssue(id: string) {
  await deleteIssues([id]);
}
