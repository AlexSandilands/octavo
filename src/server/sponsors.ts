import "server-only";
import { createHash } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { images, sponsors } from "@/db/schema";
import { keyToUrl } from "@/lib/storage";
import type { ResolvedImage } from "@/lib/images";
import { likePattern } from "@/lib/list-query";
import { ADMIN_LIST_PAGE_SIZE, pageBounds } from "@/lib/pagination";
import {
  activeUntilToDateString,
  collectSponsorIds,
  expiredBefore,
  isSponsorExpired,
  type SponsorFilter,
  type SponsorList,
  type SponsorListItem,
  type SponsorMap,
} from "@/lib/sponsors";
import type { IssueContent } from "@/lib/blocks";
import { sweepOrphanedObjects, takeOrphanedImages } from "./asset-cleanup";

// Server-only data access for managed sponsors. Editor, reader and the admin
// sponsors page go through here — never Drizzle directly. Every read joins the
// logo image so callers get a ready-to-render URL, mirroring server/images.ts.

// The columns every query selects, joined to the logo image. Explicit list — no
// spreads — so a schema change can't silently widen what we read.
const sponsorSelection = {
  id: sponsors.id,
  name: sponsors.name,
  href: sponsors.href,
  logoId: sponsors.logoId,
  activeUntil: sponsors.activeUntil,
  createdAt: sponsors.createdAt,
  logoKey: images.key,
  logoWidth: images.width,
  logoHeight: images.height,
};

// The database handle or a transaction on it, so one query builder serves both.
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type SponsorRow = {
  id: string;
  name: string;
  href: string | null;
  logoId: string | null;
  activeUntil: Date | null;
  createdAt: Date;
  logoKey: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
};

function rowLogo(row: SponsorRow): ResolvedImage | null {
  if (!row.logoKey) return null;
  return {
    url: keyToUrl(row.logoKey),
    width: row.logoWidth,
    height: row.logoHeight,
  };
}

// Every sponsor read the admin sees, from one builder: same columns, same logo
// join, same order. The id breaks ties on `createdAt`, which two sponsors can
// share, so the order is total and a page boundary can't drop or repeat a row.
function sponsorList(executor: Executor, where?: SQL) {
  return executor
    .select(sponsorSelection)
    .from(sponsors)
    .leftJoin(images, eq(sponsors.logoId, images.id))
    .where(where)
    .orderBy(desc(sponsors.createdAt), desc(sponsors.id));
}

// The WHERE for a search + status filter. Expiry is the day-level rule in
// lib/sponsors, in the form a SQL `where` can take — the same cutoff the
// per-row flag and the summary's tally are computed from, so the three agree
// even when a request straddles local midnight.
function sponsorWhere(query: string, filter: SponsorFilter, now: Date) {
  const cutoff = expiredBefore(now);
  const conditions = [
    query ? ilike(sponsors.name, likePattern(query)) : undefined,
    filter === "expired"
      ? lt(sponsors.activeUntil, cutoff)
      : filter === "active"
        ? or(isNull(sponsors.activeUntil), gte(sponsors.activeUntil, cutoff))
        : undefined,
  ].filter((c) => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// The admin list + editor picker shape: every sponsor, newest first, with logo
// resolved and expiry pre-computed on the server.
export async function listSponsors(): Promise<SponsorListItem[]> {
  const now = new Date();
  const rows = await sponsorList(db);
  return rows.map((row) => toListItem(row, now));
}

// One clock per read: the flag on each row and the count in the summary have to
// agree even when a request straddles local midnight.
function toListItem(row: SponsorRow, now: Date): SponsorListItem {
  return {
    id: row.id,
    name: row.name,
    href: row.href,
    logoId: row.logoId,
    logo: rowLogo(row),
    activeUntil: activeUntilToDateString(row.activeUntil),
    expired: isSponsorExpired(row.activeUntil, now),
  };
}

// The admin list, paged — the snapshot and clamp rationale is listIssuesPage's.
// The search and the filter run in the database, so they see every sponsor
// rather than only the served page.
export async function listSponsorsPage(
  opts: { query?: string; page?: number; filter?: SponsorFilter } = {},
): Promise<SponsorList> {
  const now = new Date();
  const query = opts.query?.trim() ?? "";
  const where = sponsorWhere(query, opts.filter ?? "all", now);

  return db.transaction(
    async (tx) => {
      const [counts] = await tx
        .select({
          total: count(),
          expiredTotal:
            sql`count(*) filter (where ${lt(sponsors.activeUntil, expiredBefore(now))})`.mapWith(
              Number,
            ),
          matching: where
            ? sql`count(*) filter (where ${where})`.mapWith(Number)
            : count(),
        })
        .from(sponsors);
      const matching = counts?.matching ?? 0;
      const bounds = pageBounds(matching, ADMIN_LIST_PAGE_SIZE, opts.page);

      const rows = await sponsorList(tx, where)
        .limit(ADMIN_LIST_PAGE_SIZE)
        .offset(bounds.offset);

      return {
        rows: rows.map((row) => toListItem(row, now)),
        page: bounds.page,
        pageCount: bounds.pageCount,
        matching,
        total: counts?.total ?? 0,
        expiredTotal: counts?.expiredTotal ?? 0,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// sponsorId -> { name, href, logo } for every sponsor a document references.
// Deleted sponsors simply don't appear, so the renderers hide their slots.
export async function resolveIssueSponsors(
  content: Pick<IssueContent, "pages">,
): Promise<SponsorMap> {
  const ids = collectSponsorIds(content);
  if (ids.length === 0) return {};
  const rows = await db
    .select(sponsorSelection)
    .from(sponsors)
    .leftJoin(images, eq(sponsors.logoId, images.id))
    .where(inArray(sponsors.id, ids));
  const map: SponsorMap = {};
  for (const row of rows) {
    map[row.id] = { name: row.name, href: row.href, logo: rowLogo(row) };
  }
  return map;
}

// The sponsor fingerprint the PDF cache key carries (issue #180), the sibling of
// chromeFingerprint(). A sponsor block stores only a `sponsorId`; the name, link
// and logo are resolved at render time from the `sponsors` table, and editing or
// deleting a sponsor touches neither `issues.content` nor `issues.revision` — so
// without this segment every already-cached PDF would keep printing the old
// sponsor (or a deleted one) until something else re-keyed it. The reader hides
// a removed sponsor at once; the PDF must not go on advertising it.
//
// The material is the *resolved* state that actually reaches a printed sponsor
// card, for exactly the sponsors this document references:
//   - the name and the href, because the card prints the name and Chromium turns
//     the link into a PDF annotation (null and "" are the same thing here —
//     externalHref refuses both, so neither prints a link).
//   - the logo's URL, which carries the storage key: replacing a logo mints a new
//     image row and a new key, so the URL moves. Its width/height are deliberately
//     absent — SponsorLogo draws a plain object-contain <img> in a fixed slot and
//     never reads them (themes/shared.tsx), so they cannot change the page.
//   - a presence flag, so a referenced-but-deleted sponsor (no map entry — the
//     slot renders as nothing) hashes differently from the same sponsor existing.
//     It also fixes the arity at five fields per sponsor, so no set of names and
//     links can be rearranged into another set's material.
// Ids are sorted so the map's iteration order can't flip the hash, and fields are
// NUL-joined for the same reason chromeFingerprint does it.
//
// Inline (v1/manual) sponsor blocks carry their name/href in `content` and so are
// covered by `revision` already; only managed references contribute here. An
// issue with none says so in the key rather than hashing the empty string —
// most issues are that case, and a key is easier to read than to decode.
export function sponsorFingerprint(
  content: Pick<IssueContent, "pages">,
  resolved: SponsorMap,
): string {
  const ids = collectSponsorIds(content).sort();
  if (ids.length === 0) return "nosponsors";
  const material = ids
    .flatMap((id) => {
      const sponsor = resolved[id];
      return sponsor
        ? [id, "1", sponsor.name, sponsor.href ?? "", sponsor.logo?.url ?? ""]
        : [id, "0", "", "", ""];
    })
    .join("\u0000");
  return createHash("sha256").update(material).digest("hex").slice(0, 10);
}

export type SponsorInput = {
  name: string;
  href: string | null;
  logoId: string | null;
  activeUntil: Date | null;
};

// Explicit column list — never spread caller input into the VALUES/SET clause.
export async function createSponsor(input: SponsorInput): Promise<string> {
  const [row] = await db
    .insert(sponsors)
    .values({
      name: input.name,
      href: input.href,
      logoId: input.logoId,
      activeUntil: input.activeUntil,
    })
    .returning({ id: sponsors.id });
  if (!row) throw new Error("Failed to create sponsor");
  return row.id;
}

export async function updateSponsor(
  id: string,
  input: SponsorInput,
): Promise<void> {
  await db
    .update(sponsors)
    .set({
      name: input.name,
      href: input.href,
      logoId: input.logoId,
      activeUntil: input.activeUntil,
    })
    .where(eq(sponsors.id, id));
}

// Deleting a sponsor leaves the sponsorId dangling in any issue that placed it;
// that is intentional — the reader resolves a missing sponsor to nothing and
// hides the slot (a removed sponsor must not keep advertising). See BlockView.
//
// Its logo image goes too, under the same guard as an issue's images (issue
// #84): the same file may well be a club mark or sit in an issue's pages, and
// the reference scan — run inside this transaction, once the sponsor row is
// gone — is what decides. Storage cleanup follows the commit and is best-effort;
// the ordering argument is the one in server/asset-cleanup.ts.
export async function deleteSponsor(id: string): Promise<void> {
  const orphanedKeys = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ logoId: sponsors.logoId })
      .from(sponsors)
      .where(eq(sponsors.id, id))
      .limit(1);
    if (!row) return [];

    await tx.delete(sponsors).where(eq(sponsors.id, id));
    return row.logoId ? takeOrphanedImages(tx, [row.logoId]) : [];
  });

  await sweepOrphanedObjects({
    keys: orphanedKeys,
    context: { sponsorId: id },
  });
}
