import { z } from "zod";
import { coverPageOf, type Page } from "@/lib/blocks";
import { pageParamSchema } from "@/lib/pagination";
import { listArchivePage, listPublishedYears } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { ARCHIVE_QUERY_MAX } from "@/features/library/archive-limits";
import { ArchiveShelf } from "@/features/library/archive-shelf";
import { LibraryHeader } from "@/features/library/library-header";
import { SiteFooter } from "@/features/library/site-footer";

export const dynamic = "force-dynamic";

// The view lives entirely in the URL (?q= title search, ?year=, ?page=) so a
// refresh, a shared link and back/forward all rebuild the same shelf. The
// params are attacker-typed strings; `catch` turns anything malformed (arrays,
// "abc", page=-1) into the default rather than an error page, out-of-range
// pages are clamped by listArchivePage, and a year nothing was published in is
// dropped below. An overlong q is truncated rather than dropped: the search box
// can't produce one, so it came in a URL, and cutting it still narrows the
// shelf where a `catch` would silently show everything and wipe the box.
const paramsSchema = z.object({
  q: z
    .string()
    .catch("")
    .transform((s) => s.slice(0, ARCHIVE_QUERY_MAX)),
  page: pageParamSchema,
  year: z.coerce.number().int().catch(0),
});

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireMemberOrRedirect("/archive");
  const params = paramsSchema.parse(await searchParams);
  const query = params.q.trim();

  const [years, settings] = await Promise.all([
    listPublishedYears(),
    getSettings(),
  ]);
  // Only a year the catalogue actually has; anything else reads as "all", so
  // the filter's trigger always names one of its own options.
  const year = years.includes(params.year) ? params.year : null;

  const list = await listArchivePage({ query, year, page: params.page });

  // Covers for the served page only — one images query and one sponsors query
  // for the shelf, never the whole catalogue (see the home page for why the
  // sponsors half matters).
  const covers = list.rows
    .map((i) => coverPageOf(i.content))
    .filter((p): p is Page => Boolean(p));
  const [coverImages, coverSponsors] = await Promise.all([
    resolveIssueImages({ pages: covers }),
    resolveIssueSponsors({ pages: covers }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <LibraryHeader user={user} home />

      <div className="pt-8 pb-2">
        <h1 className="text-ink font-serif text-3xl sm:text-4xl">
          The archive
        </h1>
        <p className="text-muted mt-2 font-sans text-[15px]">
          Every issue of {settings.name}, newest first.
        </p>
      </div>

      <ArchiveShelf
        list={list}
        query={query}
        year={year}
        years={years}
        images={coverImages}
        sponsors={coverSponsors}
        settings={settings}
      />

      <SiteFooter
        org={settings.org}
        issueCount={list.total}
        estYear={list.estYear}
        signedIn={Boolean(user)}
      />
    </main>
  );
}
