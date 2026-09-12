import "server-only";
import { and, count, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import {
  ARCHIVE_PAGE_SIZE,
  HOME_ARCHIVE_MAX,
} from "@/features/library/archive-limits";
import { likePattern } from "@/lib/like-pattern";
import { pageBounds, type PagedList } from "@/lib/pagination";
import { effectiveIssueNumber, publishedYear, type IssueRow } from "./issues";

// Member-facing reads: the library home page and the full published archive.
// Admin listing and all issue CRUD stay in server/issues.ts.

const published = eq(issues.status, "published");

// extract() comes back as numeric, and min() over no rows as null — which a
// plain Number() would report as the year 0.
function asYear(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export type LibraryHome = {
  /** The featured issue, or null before anything is published. */
  latest: IssueRow | null;
  /** The capped run of back-issues shown below it. */
  recent: IssueRow[];
  publishedTotal: number;
  /** Earliest publication year across the catalogue — the footer's "Est." */
  estYear: number | null;
  /** Published issues the home page doesn't show; > 0 offers the archive. */
  older: number;
};

// Everything the library home page reads, bounded: the featured issue plus at
// most HOME_ARCHIVE_MAX back-issues, never the whole catalogue. The counts and
// the rows share one read-only REPEATABLE READ snapshot, so `older` can't
// promise an archive page that the same request's rows contradict.
export async function getLibraryHome(): Promise<LibraryHome> {
  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({ total: count(), estYear: sql`min(${publishedYear})` })
        .from(issues)
        .where(published);

      const rows = await tx
        .select()
        .from(issues)
        .where(published)
        .orderBy(desc(effectiveIssueNumber))
        .limit(HOME_ARCHIVE_MAX + 1);

      const [latest, ...recent] = rows;
      const publishedTotal = counts?.total ?? 0;
      return {
        latest: latest ?? null,
        recent,
        publishedTotal,
        estYear: asYear(counts?.estYear),
        older: Math.max(0, publishedTotal - rows.length),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The years the archive's filter offers, newest first — only years that have a
// published issue, so the menu can never name an empty view.
export async function listPublishedYears(): Promise<number[]> {
  // Sorted here, not in SQL: the timezone rides in as a bind parameter, and
  // SELECT DISTINCT rejects an ORDER BY whose copy of it is a second parameter.
  // One row per year, so the sort is free.
  const rows = await db
    .selectDistinct({ year: publishedYear })
    .from(issues)
    .where(and(published, isNotNull(issues.publishedAt)));
  return rows.map((r) => Number(r.year)).sort((a, b) => b - a);
}

// The archive's title search + year filter, as one WHERE. Both narrow in the
// database because the page only serves ARCHIVE_PAGE_SIZE covers — a
// client-side filter would go blind past them.
function archiveWhere(query: string, year: number | null) {
  const conditions = [
    published,
    query ? ilike(issues.title, likePattern(query)) : undefined,
    year != null ? sql`${publishedYear} = ${year}` : undefined,
  ].filter((c) => c !== undefined);
  return and(...conditions);
}

export type ArchiveList = PagedList<IssueRow> & {
  /** Published issues in the whole catalogue, whatever narrows the view. */
  total: number;
  estYear: number | null;
};

// One page of the full archive. Unique displayed numbers descending are a total
// order, which is what makes plain offset paging safe; an out-of-range page is
// clamped rather than 404ed, so a held URL lands on the nearest real page.
//
// Two statements — every count in one aggregate pass, then the page's rows —
// inside a read-only REPEATABLE READ transaction, so the clamp is computed
// from the same world the covers come from.
export async function listArchivePage(
  opts: { query?: string; year?: number | null; page?: number } = {},
): Promise<ArchiveList> {
  const where = archiveWhere(opts.query?.trim() ?? "", opts.year ?? null);

  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({
          total: count(),
          estYear: sql`min(${publishedYear})`,
          matching: sql`count(*) filter (where ${where})`.mapWith(Number),
        })
        .from(issues)
        .where(published);
      const matching = counts?.matching ?? 0;
      const bounds = pageBounds(matching, ARCHIVE_PAGE_SIZE, opts.page);

      const rows = await tx
        .select()
        .from(issues)
        .where(where)
        .orderBy(desc(effectiveIssueNumber))
        .limit(ARCHIVE_PAGE_SIZE)
        .offset(bounds.offset);

      return {
        rows,
        page: bounds.page,
        pageCount: bounds.pageCount,
        matching,
        total: counts?.total ?? 0,
        estYear: asYear(counts?.estYear),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
