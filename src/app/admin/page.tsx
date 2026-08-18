import Link from "next/link";
import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { ListPagination } from "@/components/list-pagination";
import { Button, Pill } from "@/components/ui";
import { EmptyIssues } from "@/components/empty-states";
import { coverPageOf, type Page } from "@/lib/blocks";
import { pageParamSchema } from "@/lib/pagination";
import { listIssuesPage } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";
import { CoverThumb } from "@/features/library/cover-thumb";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { DeleteIssueButton } from "@/features/admin/delete-issue-button";
import { createIssueAction } from "./actions";

export const dynamic = "force-dynamic";

// Row thumbnail: the issue's real cover page, rendered small through the same
// pipeline the library uses (falling back to a placeholder for legacy issues
// with no cover page).
const THUMB_W = 46;
const THUMB_H = Math.round((THUMB_W * PAGE_H) / PAGE_W);

// The page lives in the URL (?page=), so a refresh — and the revalidate after a
// create, publish or delete — lands the admin back where they were.
const paramsSchema = z.object({ page: pageParamSchema });

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout gates too, but layouts don't re-run on soft navigation.
  const admin = await requireAdminOrRedirect();
  const params = paramsSchema.parse(await searchParams);
  const settings = await getSettings();
  const list = await listIssuesPage(params.page);
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

  return (
    <AdminShell active="issues" user={admin}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Issues</h1>
          {/* Whole-list numbers, so the summary holds on every page. */}
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
        <div className="mt-6">
          {issues.map((i) => {
            const editHref = `/admin/issues/${i.id}/edit`;
            const cover = coverPageOf(i.content);
            return (
              <div
                key={i.id}
                className="border-line-soft flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:gap-5"
              >
                <div className="flex min-w-0 items-center gap-4 sm:flex-1 sm:gap-5">
                  <Link
                    href={editHref}
                    aria-label={`Edit ${i.title}`}
                    tabIndex={-1}
                    className="flex-none overflow-hidden rounded-[3px] shadow-[0_1px_4px_-1px_rgba(20,32,28,0.35)]"
                    style={{ width: THUMB_W, height: THUMB_H }}
                  >
                    {cover ? (
                      <CoverThumb
                        page={cover}
                        theme={i.theme}
                        images={coverImages}
                        sponsors={coverSponsors}
                        issueNo={i.number}
                        settings={settingsForIssue(settings, i)}
                        width={THUMB_W}
                      />
                    ) : (
                      <div className="photo-fill h-full w-full" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <Link
                        href={editHref}
                        className="text-ink hover:text-accent font-serif text-[19px] leading-tight hover:underline"
                      >
                        {i.title}
                      </Link>
                      <span className="text-faint2 font-mono text-[11px]">
                        No. {i.number}
                      </span>
                    </div>
                    <div className="text-faint mt-1 font-sans text-[13px]">
                      {i.content.pages.length}{" "}
                      {i.content.pages.length === 1 ? "page" : "pages"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center justify-between gap-3 pl-[62px] sm:justify-end sm:gap-4 sm:pl-0">
                  <Pill
                    status={i.status === "published" ? "Published" : "Draft"}
                  />
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Link
                      href={editHref}
                      className="text-accent text-right font-sans text-sm font-semibold hover:underline sm:w-14"
                    >
                      Edit
                    </Link>
                    <DeleteIssueButton id={i.id} title={i.title} />
                  </div>
                </div>
              </div>
            );
          })}
          <ListPagination
            page={list.page}
            pageCount={list.pageCount}
            label="Issue list pages"
          />
        </div>
      )}
    </AdminShell>
  );
}
