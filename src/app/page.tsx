import Link from "next/link";
import { Wordmark, Avatar } from "@/components/ui";
import { site } from "@/lib/site";
import { listIssues } from "@/server/issues";
import { LatestIssue } from "@/features/library/latest-issue";
import { ArchiveGrid } from "@/features/library/archive-grid";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const all = await listIssues();
  const published = all.filter((i) => i.status === "published");
  const latest = published[0];
  const archive = published.slice(1);

  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="border-line flex items-center justify-between border-b pb-4">
        <Wordmark size={24} />
        <nav className="flex items-center gap-4 font-sans text-sm">
          <span className="text-muted font-medium">Issues</span>
          <span className="text-faint2">Membership</span>
          <Link
            href="/admin"
            className="border-hair text-ink hover:border-accent hover:text-accent rounded-lg border px-3 py-1.5 font-medium"
          >
            Admin
          </Link>
          <Avatar initials="MC" />
        </nav>
      </header>

      {!latest ? (
        <section className="py-20 text-center">
          <h1 className="text-ink font-serif text-3xl">No issues published yet</h1>
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
          />
          {archive.length > 0 && <ArchiveGrid items={archive} />}
        </>
      )}
    </main>
  );
}
