import { Button } from "@/components/ui";
import { Masthead, memberTabs } from "@/components/masthead";
import { coverPageOf, type Page } from "@/lib/blocks";
import { getLibraryHome } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { LatestIssue } from "@/features/library/latest-issue";
import { BackIssues, toArchiveItems } from "@/features/library/back-issues";
import { issueMonth } from "@/features/library/contents";
import { SiteFooter } from "@/features/library/site-footer";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requireMemberOrRedirect("/");
  const settings = await getSettings();
  // The featured issue plus a capped run of back-issues — the deep catalogue
  // lives at /archive, so this page stays the same length however long the
  // magazine runs (issue #192).
  const { latest, recent, publishedTotal, estYear, older } =
    await getLibraryHome();

  // Resolve every cover's images and managed sponsors in one query each, then
  // render each issue's cover page as its thumbnail (shared maps; extra ids are
  // harmless per thumb). Both traverse only the cover pages, so neither reads a
  // row the shelf can't draw. The sponsors half matters because a managed
  // sponsor block carries nothing but its id — unresolved, BlockView renders it
  // as nothing and the block drops out of a supposedly to-scale render (#170).
  const shelf = latest ? [latest, ...recent] : [];
  const covers = shelf
    .map((i) => coverPageOf(i.content))
    .filter((p): p is Page => Boolean(p));
  const [coverImages, coverSponsors] = await Promise.all([
    resolveIssueImages({ pages: covers }),
    resolveIssueSponsors({ pages: covers }),
  ]);

  const month = latest ? issueMonth(latest.publishedAt) : null;
  const dateline = latest
    ? `Issue No. ${latest.number}${month ? ` · ${month}` : ""}`
    : undefined;

  return (
    <>
      <Masthead
        dateline={dateline}
        user={user}
        tabs={memberTabs(user)}
        active="latest"
      />
      <main className="mx-auto max-w-5xl px-5 pb-6 sm:px-8 sm:pb-10">
        {!latest ? (
          <section className="py-20 text-center">
            <h1 className="text-lead font-display text-[36px] font-semibold">
              No issues published yet
            </h1>
            <p className="text-grey mt-3 font-ui">
              The first issue of {settings.name} will appear here once it&apos;s
              published.
            </p>
          </section>
        ) : (
          <>
            <LatestIssue
              number={latest.number}
              title={latest.title}
              content={latest.content}
              publishedAt={latest.publishedAt}
              theme={latest.theme}
              cover={coverPageOf(latest.content)}
              images={coverImages}
              sponsors={coverSponsors}
              settings={settings}
            />
            {recent.length > 0 && (
              <BackIssues
                items={toArchiveItems(recent)}
                images={coverImages}
                sponsors={coverSponsors}
                settings={settings}
                heading="Back issues"
              />
            )}
            {/* Only once the catalogue outgrows the shelf above: a magazine with
                a page's worth of issues shows them all and needs no way out. */}
            {older > 0 && (
              <div className="rule-heavy flex justify-center pt-6 pb-4">
                <Button href="/archive" variant="secondary" icon="arrowRight">
                  View the full archive
                </Button>
              </div>
            )}
          </>
        )}

        <SiteFooter
          org={settings.org}
          issueCount={publishedTotal}
          estYear={estYear}
        />
      </main>
    </>
  );
}
