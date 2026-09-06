import Link from "next/link";
import { Button, Kicker, Label } from "@/components/ui";
import type { SiteSettings } from "@/lib/branding";
import type { IssueContent, Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { CoverThumb } from "./cover-thumb";
import { DownloadPdfButton } from "./download-pdf-button";
import { issueMonth, issueSections } from "./contents";

type LatestIssueProps = {
  number: number;
  title: string;
  content: IssueContent;
  publishedAt: Date | null;
  theme: string;
  cover?: Page;
  images: ImageMap;
  /** Resolved managed sponsors for the cover pages — the thumbnail needs them
   *  to draw a sponsor block the same way the reader does (issue #170). */
  sponsors: SponsorMap;
  /** The magazine's branding and PDF-download setting. */
  settings: SiteSettings;
};

// The library hero: the cover as a physical object on the left, and an editorial
// "in this issue" teaser on the right so the latest issue sells itself.
export function LatestIssue({
  number,
  title,
  content,
  publishedAt,
  theme,
  cover,
  images,
  sponsors,
  settings,
}: LatestIssueProps) {
  const pageCount = content.pages.length;
  const month = issueMonth(publishedAt);
  const sections = issueSections(content);
  const shown = sections.slice(0, 4);

  return (
    <section className="border-line/70 grid gap-8 border-b py-10 md:grid-cols-[240px_1fr]">
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="group relative block w-[240px] self-start"
      >
        <div className="relative overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(15,23,42,0.14)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_rgba(29,78,216,0.22)]">
          {cover ? (
            <CoverThumb
              page={cover}
              theme={theme}
              images={images}
              sponsors={sponsors}
              issueNo={number}
              settings={settings}
              width={240}
              priority
            />
          ) : (
            // Legacy issues without a cover page keep the stylised book panel.
            <div className="photo-fill-green relative flex h-[330px] flex-col justify-between p-6 rounded-xl">
              <div className="text-cream font-sans text-[12px] font-bold tracking-[0.16em] uppercase">
                {settings.name} · No. {number}
              </div>
              <div className="text-white font-sans font-black text-3xl leading-[1.0] tracking-tight">
                {title}
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col">
        <Kicker>Latest Release</Kicker>
        {/* h2: the page's single h1 is the masthead standfirst (see page.tsx). */}
        <h2 className="text-ink mt-3 font-sans text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
          {title}
        </h2>
        <div className="mt-3 flex items-center gap-2">
          <span className="bg-slate-100 text-muted rounded-full px-3 py-1 font-sans text-xs font-semibold">
            Issue #{number}
          </span>
          <span className="text-faint font-sans text-xs font-medium">
            {pageCount} {pageCount === 1 ? "page" : "pages"}
            {month ? ` · ${month}` : ""}
          </span>
        </div>

        {shown.length > 0 && (
          <div className="border-line-soft mt-6 border-t pt-5">
            <Label>In this issue</Label>
            <ol className="mt-3">
              {shown.map((s, i) => (
                <li
                  key={i}
                  className="border-line-soft/70 border-b last:border-0"
                >
                  <Link
                    href={`/read/${number}`}
                    aria-label={`Read this issue: ${s.title}`}
                    className="group/entry flex min-h-11 items-baseline gap-3 py-2.5"
                  >
                    <span className="text-accent/70 w-5 flex-none font-mono text-[11px] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink font-serif text-[17px] leading-snug group-hover/entry:underline">
                      {s.title}
                    </span>
                    {s.kicker && (
                      <span className="text-faint ml-auto flex-none pl-3 font-sans text-[10px] tracking-[0.18em] uppercase">
                        {s.kicker}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
            {sections.length > shown.length && (
              <div className="text-faint2 mt-2.5 font-serif text-sm italic">
                + {sections.length - shown.length} more
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          <Button href={`/read/${number}`} icon="arrowRight">
            Read this issue
          </Button>
          {/* The owner can switch downloads off site-wide (issue #162). This is
              a Server Component, so "off" means the control is never built —
              not hidden with CSS, not decided in the browser. */}
          {settings.pdfDownloads && <DownloadPdfButton issueNumber={number} />}
        </div>
      </div>
    </section>
  );
}
