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
    <section className="index-latest">
      <div className="index-latest-intro">
        <Kicker>01 / Now reading</Kicker>
        {/* h2: the page's single h1 is the masthead standfirst (see page.tsx). */}
        <h2 className="index-latest-heading text-ink mt-3">{title}</h2>
        <div className="text-faint mt-3 font-sans text-[13px] tracking-wide">
          No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
          {month ? ` · ${month}` : ""}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button href={`/read/${number}`} icon="arrowRight">
            Read this issue
          </Button>
          {/* The owner can switch downloads off site-wide (issue #162). This is
              a Server Component, so "off" means the control is never built —
              not hidden with CSS, not decided in the browser. */}
          {settings.pdfDownloads && <DownloadPdfButton issueNumber={number} />}
        </div>
      </div>
      <div className="index-latest-cover">
        <div className="index-issue-number">
          ISSUE {String(number).padStart(3, "0")} / LATEST
        </div>
        <Link
          href={`/read/${number}`}
          aria-label={`Read ${title}`}
          className="group relative block w-[240px]"
        >
          <div className="relative overflow-hidden">
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
              <div className="photo-fill-green relative flex h-[330px] flex-col justify-between p-5">
                <div className="absolute inset-y-0 left-0 w-[7px] bg-black/20" />
                <div className="absolute inset-y-0 left-[7px] w-px bg-white/10" />
                <div className="text-cream font-serif text-[13px] tracking-[0.1em]">
                  {settings.name} · No. {number}
                </div>
                <div className="text-paper font-serif text-4xl leading-[0.96]">
                  {title}
                </div>
              </div>
            )}
          </div>
        </Link>
        <span className="text-muted font-mono text-xs">
          {month} · {pageCount} pages
        </span>
      </div>

      {shown.length > 0 && (
        <div className="index-latest-contents">
          <Label>Contents / {sections.length} stories</Label>
          <ol className="mt-3">
            {shown.map((s, i) => (
              <li key={i} className="last:border-0">
                <Link
                  href={`/read/${number}`}
                  aria-label={`Read this issue: ${s.title}`}
                  className="index-contents-entry group/entry"
                >
                  <span className="text-accent font-mono text-xs tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink leading-snug group-hover/entry:underline">
                    {s.title}
                  </span>
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
    </section>
  );
}
