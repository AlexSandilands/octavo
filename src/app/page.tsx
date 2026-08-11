import Link from "next/link";
import { Wordmark, Avatar } from "@/components/ui";
import { DemoBadge } from "@/components/demo-badge";
import { SignOutButton } from "@/components/sign-out-button";
import { initials } from "@/lib/initials";
import { coverPageOf, type Page } from "@/lib/blocks";
import { listIssues } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";
import { LatestIssue } from "@/features/library/latest-issue";
import { ArchiveGrid } from "@/features/library/archive-grid";
import { Masthead } from "@/features/library/masthead";
import { SiteFooter } from "@/features/library/site-footer";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requireMemberOrRedirect("/");
  const settings = await getSettings();
  const all = await listIssues();
  const published = all.filter((i) => i.status === "published");
  const latest = published[0];
  const archive = published.slice(1);

  // Earliest publication year across the catalogue — the footer's "Est." line.
  const years = published
    .map((i) => i.publishedAt?.getFullYear())
    .filter((y): y is number => y != null);
  const estYear = years.length ? Math.min(...years) : null;

  // Resolve every cover's images and managed sponsors in one query each, then
  // render each issue's cover page as its thumbnail (shared maps; extra ids are
  // harmless per thumb). Both traverse only the cover pages, so neither reads a
  // row the shelf can't draw. The sponsors half matters because a managed
  // sponsor block carries nothing but its id — unresolved, BlockView renders it
  // as nothing and the block drops out of a supposedly to-scale render (#170).
  const covers = published
    .map((i) => coverPageOf(i.content))
    .filter((p): p is Page => Boolean(p));
  const [coverImages, coverSponsors] = await Promise.all([
    resolveIssueImages({ pages: covers }),
    resolveIssueSponsors({ pages: covers }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="border-line flex items-center justify-between gap-3 border-b pb-4">
        <Wordmark size={24} />
        <nav className="flex flex-none items-center gap-3 font-sans text-sm sm:gap-4">
          {/* No user only happens in demo mode (the gate redirects otherwise):
              swap the account affordances for the demo chip. */}
          {user ? (
            <>
              {/* UX only — /admin is gated server-side regardless (issue #4). */}
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="border-hair text-ink hover:border-accent hover:text-accent rounded-lg border px-3 py-1.5 font-medium"
                >
                  Admin
                </Link>
              )}
              <SignOutButton />
              <Avatar initials={initials(user.name?.trim() || user.email)} />
            </>
          ) : (
            <DemoBadge />
          )}
        </nav>
      </header>

      <Masthead org={settings.org} tagline={settings.tagline} />

      {!latest ? (
        <section className="py-20 text-center">
          <h2 className="text-ink font-serif text-3xl">
            No issues published yet
          </h2>
          <p className="text-muted mt-3 font-sans">
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
            settings={settingsForIssue(settings, latest)}
          />
          {archive.length > 0 && (
            <ArchiveGrid
              items={archive.map((i) => ({
                id: i.id,
                number: i.number,
                title: i.title,
                publishedAt: i.publishedAt,
                theme: i.theme,
                cover: coverPageOf(i.content),
                // The issue's footer reserve (issue #128) — each card clamps
                // the magazine's footer to its own issue's.
                footerMarkSize: i.footerMarkSize,
                footerTextSize: i.footerTextSize,
              }))}
              images={coverImages}
              sponsors={coverSponsors}
              settings={settings}
            />
          )}
        </>
      )}

      <SiteFooter
        org={settings.org}
        issueCount={published.length}
        estYear={estYear}
        signedIn={Boolean(user)}
      />
    </main>
  );
}
