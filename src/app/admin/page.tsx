import { z } from "zod";
import { ADMIN_LIST_PAGE } from "@/components/admin-list-layout";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui";
import { EmptyIssues } from "@/components/empty-states";
import { coverPageOf, type Page } from "@/lib/blocks";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { pageParamSchema } from "@/lib/pagination";
import { listIssuesPage, listIssueYears } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { CoverThumb } from "@/features/library/cover-thumb";
import { THUMB_W } from "@/features/admin/issue-thumb";
import { IssuesTable } from "@/features/admin/issues-table";
import { createIssueAction } from "./actions";

export const dynamic = "force-dynamic";

// The list state lives in the URL (?q= search, ?filter= status, ?year=, ?page=)
// so a refresh — and the revalidate after a create, publish or delete — lands
// the admin back where they were. Params are attacker-typed strings; `catch`
// turns anything malformed into the default rather than an error page.
// Out-of-range pages are clamped by listIssuesPage, not here. An overlong q is
// truncated rather than rejected: the search box can't produce one (maxLength),
// so it came in a URL, and cutting it still narrows the list where a `catch`
// would silently show everything and wipe the box.
const paramsSchema = z.object({
  q: z
    .string()
    .catch("")
    .transform((s) => s.slice(0, ADMIN_LIST_QUERY_MAX)),
  page: pageParamSchema,
  filter: z.enum(["all", "draft", "published"]).catch("all"),
  year: z.coerce.number().int().min(1000).max(9999).nullable().catch(null),
});

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  const params = paramsSchema.parse(await searchParams);
  const query = params.q.trim();
  const settings = await getSettings();
  const [list, years] = await Promise.all([
    listIssuesPage({
      query,
      page: params.page,
      filter: params.filter,
      year: params.year,
    }),
    listIssueYears(),
  ]);
  const issues = list.rows;

  // Resolve every cover's images and managed sponsors in one query each, then
  // render each issue's cover page as its thumbnail (shared maps; extra ids are
  // harmless per thumb). The row thumbnail runs the same pipeline the library
  // does, so it needs the same resolutions (issue #170).
  const covers = issues
    .map((i) => coverPageOf(i.content))
    .filter((p): p is Page => Boolean(p));
  const [coverImages, coverSponsors] = await Promise.all([
    resolveIssueImages({ pages: covers }),
    resolveIssueSponsors({ pages: covers }),
  ]);

  // The rows are handed to a client component, which owns the selection — so
  // each cover is rendered here, on the server, and travels as the row's thumb.
  const rows = issues.map((i) => {
    const cover = coverPageOf(i.content);
    return {
      id: i.id,
      number: i.number,
      title: i.title,
      status: i.status,
      pages: i.content.pages.length,
      thumb: cover ? (
        <CoverThumb
          page={cover}
          theme={i.theme}
          images={coverImages}
          sponsors={coverSponsors}
          issueNo={i.number}
          settings={settings}
          width={THUMB_W}
        />
      ) : null,
    };
  });

  return (
    <AdminShell active="issues" user={admin}>
      {/* Pinned header and filters over scrolling rows from md up; see
          admin-list-layout.ts. */}
      <div className={ADMIN_LIST_PAGE}>
        <div className="flex flex-none flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-ink font-serif text-3xl">Issues</h1>
            {/* Whole-list numbers, so the summary holds on every page and under
              every search. */}
            <p className="text-faint mt-1.5 font-sans text-sm">
              {list.total} {list.total === 1 ? "issue" : "issues"} ·{" "}
              {list.draftTotal} in draft
            </p>
          </div>
          <form action={createIssueAction} className="flex-none">
            <Button
              type="submit"
              icon="plus"
              iconPosition="left"
              className="w-full whitespace-nowrap sm:w-auto"
            >
              Create new issue
            </Button>
          </form>
        </div>

        {list.total === 0 ? (
          <div className="mt-8">
            <EmptyIssues />
          </div>
        ) : (
          <IssuesTable
            rows={rows}
            page={list.page}
            pageCount={list.pageCount}
            matching={list.matching}
            query={query}
            filter={params.filter}
            year={params.year}
            years={years}
          />
        )}
      </div>
    </AdminShell>
  );
}
