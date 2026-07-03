import Link from "next/link";
import { Wordmark, Avatar } from "@/components/ui";
import { site } from "@/lib/site";
import { initials } from "@/lib/initials";
import { coverPageOf, type Page } from "@/lib/blocks";
import { listIssues } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { requireMemberOrRedirect } from "@/server/session";
import { signOutAction } from "@/app/signin/actions";
import { LatestIssue } from "@/features/library/latest-issue";
import { ArchiveGrid } from "@/features/library/archive-grid";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requireMemberOrRedirect("/");
  const all = await listIssues();
  const published = all.filter((i) => i.status === "published");
  const latest = published[0];
  const archive = published.slice(1);

  // Resolve every cover's images in one query, then render each issue's cover
  // page as its thumbnail (shared map; extra ids are harmless per thumb).
  const covers = published
    .map((i) => coverPageOf(i.content))
    .filter((p): p is Page => Boolean(p));
  const coverImages = await resolveIssueImages({ pages: covers });

  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="border-line flex items-center justify-between border-b pb-4">
        <Wordmark size={24} />
        <nav className="flex items-center gap-4 font-sans text-sm">
          <span className="text-muted font-medium">Issues</span>
          {/* UX only — /admin is gated server-side regardless (issue #4). */}
          {user.isAdmin && (
            <Link
              href="/admin"
              className="border-hair text-ink hover:border-accent hover:text-accent rounded-lg border px-3 py-1.5 font-medium"
            >
              Admin
            </Link>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-muted hover:text-accent flex h-11 items-center font-medium"
            >
              Sign out
            </button>
          </form>
          <Avatar initials={initials(user.name?.trim() || user.email)} />
        </nav>
      </header>

      {!latest ? (
        <section className="py-20 text-center">
          <h1 className="text-ink font-serif text-3xl">
            No issues published yet
          </h1>
          <p className="text-muted mt-3 font-sans">
            The first issue of {site.name} will appear here once it&apos;s
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
              }))}
              images={coverImages}
            />
          )}
        </>
      )}
    </main>
  );
}
