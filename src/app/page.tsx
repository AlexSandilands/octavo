import { SiteBar } from "@/components/site-bar";
import { Button } from "@/components/ui";
import { coverPageOf, type Page } from "@/lib/blocks";
import { getLibraryHome } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { LatestIssue } from "@/features/library/latest-issue";
import { CoverCard, toCoverItems } from "@/features/library/cover-card";
import { CoverShelf } from "@/features/library/cover-shelf";
import { Masthead } from "@/features/library/masthead";
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

  return (
    <>
      {/* The archive is offered only once the catalogue outgrows the shelf: a
          magazine with a page's worth of issues shows them all here. */}
      <SiteBar user={user} archive={older > 0} />
      <main className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <Masthead org={settings.org} tagline={settings.tagline} />

        {!latest ? (
          <section className="py-24 text-center">
            <h2 className="text-chrome-text font-display text-3xl">
              No issues published yet
            </h2>
            <p className="text-chrome-muted mt-3 font-ui text-[17px]">
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
              <CoverShelf
                label="Recent issues"
                summary={`${recent.length} ${recent.length === 1 ? "issue" : "issues"}`}
              >
                {toCoverItems(recent).map((item, idx) => (
                  <CoverCard
                    key={item.id}
                    item={item}
                    index={idx}
                    images={coverImages}
                    sponsors={coverSponsors}
                    settings={settings}
                    year
                  />
                ))}
              </CoverShelf>
            )}
            {older > 0 && (
              <div className="border-hairline mt-2 flex justify-center border-t pt-8 pb-2">
                <Button
                  href="/archive"
                  variant="secondary"
                  tone="dark"
                  icon="arrowRight"
                >
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
          signedIn={Boolean(user)}
        />
      </main>
    </>
  );
}
