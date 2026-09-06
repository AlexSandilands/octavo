import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyCard } from "@/components/empty-states";
import { Icon } from "@/components/icons";
import { coverPageOf, type Page } from "@/lib/blocks";
import { getLibraryHome } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { GreetingCard } from "@/features/library/greeting-card";
import { LatestIssue } from "@/features/library/latest-issue";
import { ArchiveGrid, toArchiveItems } from "@/features/library/archive-grid";
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
    <AppShell area="member" active="library" user={user}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <GreetingCard
          name={user?.name ?? null}
          org={settings.org}
          tagline={settings.tagline}
        />

        {!latest ? (
          <EmptyCard
            icon="library"
            title="No issues published yet"
            body={`The first issue of ${settings.name} will appear here once it's published.`}
          />
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
              <ArchiveGrid
                items={toArchiveItems(recent)}
                images={coverImages}
                sponsors={coverSponsors}
                settings={settings}
              />
            )}
            {/* Only once the catalogue outgrows the shelf above: a magazine with
                a page's worth of issues shows them all and needs no way out. */}
            {older > 0 && (
              <Link
                href="/archive"
                className="bg-surface border-hairline shadow-card hover:border-primary flex items-center gap-4 rounded-card border p-5 transition-colors"
              >
                <span className="bg-primary-soft text-primary flex h-12 w-12 flex-none items-center justify-center rounded-full">
                  <Icon name="archive" size={24} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-fg block font-ui text-[18px] font-bold">
                    View the full archive
                  </span>
                  <span className="text-fg-muted block font-ui text-[15px]">
                    {older} more {older === 1 ? "issue" : "issues"}, searchable
                    by title and year
                  </span>
                </span>
                <Icon
                  name="chevronRight"
                  size={24}
                  strokeWidth={2}
                  className="text-primary flex-none"
                />
              </Link>
            )}
          </>
        )}

        <SiteFooter
          org={settings.org}
          issueCount={publishedTotal}
          estYear={estYear}
        />
      </div>
    </AppShell>
  );
}
