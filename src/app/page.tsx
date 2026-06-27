import Link from "next/link";
import { Wordmark, Button, Avatar, Kicker, Label } from "@/components/ui";
import { site } from "@/lib/site";
import { listIssues } from "@/server/issues";

export const dynamic = "force-dynamic";

const ARCHIVE_TINTS = ["#cdbfa6", "#9fb0a6", "#c2a99a", "#b3aec0"];

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
          <section className="border-line-soft grid gap-7 border-b py-8 md:grid-cols-[230px_1fr]">
            <Link href={`/read/${latest.number}`} aria-label={`Read ${latest.title}`}>
              <div className="photo-fill-green flex h-[300px] flex-col justify-between rounded-[5px] p-5">
                <div className="text-cream font-serif text-[13px] tracking-[0.1em]">
                  {site.name} · No. {latest.number}
                </div>
                <div className="text-paper font-serif text-4xl leading-[0.96]">
                  {latest.title}
                </div>
              </div>
            </Link>
            <div className="flex flex-col">
              <Kicker>The latest issue</Kicker>
              <h1 className="text-ink mt-3 font-serif text-4xl">{latest.title}</h1>
              <p className="text-muted mt-2 max-w-prose font-serif text-[17px] italic">
                {latest.content.pages.length} pages · No. {latest.number}
              </p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <Button href={`/read/${latest.number}`} icon="arrowRight">
                  Read this issue
                </Button>
                <Button variant="secondary" icon="download">
                  PDF
                </Button>
              </div>
            </div>
          </section>

          {archive.length > 0 && (
            <section className="py-8">
              <Label>The archive</Label>
              <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {archive.map((a, idx) => {
                  const tint = ARCHIVE_TINTS[idx % ARCHIVE_TINTS.length];
                  return (
                    <Link key={a.id} href={`/read/${a.number}`} className="group">
                      <div
                        className="flex h-[148px] items-end rounded-[4px] p-3"
                        style={{
                          backgroundImage: `repeating-linear-gradient(135deg, ${tint} 0, ${tint} 10px, #00000010 10px, #00000010 20px)`,
                        }}
                      >
                        <span className="font-serif text-xs text-[#3a372f]">
                          No. {a.number}
                        </span>
                      </div>
                      <div className="text-ink mt-2 font-serif text-[15px] leading-tight group-hover:underline">
                        {a.title}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
