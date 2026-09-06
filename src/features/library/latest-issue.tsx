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

const COVER_W = 300;

// The front page: a headline band (kicker, the issue's title set very large,
// a standfirst with the number, length and month), then the cover beside the
// "In this issue" index with dotted leaders, closing on two labelled buttons.
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
  const shown = sections.slice(0, 6);

  return (
    <section className="pt-7 pb-10">
      <Kicker>The latest issue</Kicker>
      {/* The page's single h1: the masthead names the magazine, this names
          the issue. */}
      <h1 className="text-lead mt-3 font-display text-[40px] leading-[1.02] font-semibold text-balance sm:text-[64px]">
        {title}
      </h1>
      <p className="text-grey mt-4 font-ui text-[17px] tabular-nums">
        No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
        {month ? ` · ${month}` : ""}
      </p>

      <div className="rule-heavy mt-6 grid gap-8 pt-6 md:grid-cols-[300px_1fr] md:gap-12">
        <Link
          href={`/read/${number}`}
          aria-label={`Read ${title}`}
          className="border-lead block w-full max-w-[300px] justify-self-center border md:justify-self-start"
        >
          {cover ? (
            <CoverThumb
              page={cover}
              theme={theme}
              images={images}
              sponsors={sponsors}
              issueNo={number}
              settings={settings}
              width={COVER_W - 2}
              priority
            />
          ) : (
            // Legacy issues without a cover page keep the stylised book panel.
            <div className="photo-fill-green flex h-[418px] flex-col justify-between p-5">
              <div className="text-sheet font-display text-[13px] tracking-[0.1em]">
                {settings.name} · No. {number}
              </div>
              <div className="text-sheet font-display text-4xl leading-[0.96]">
                {title}
              </div>
            </div>
          )}
        </Link>

        <div className="flex min-w-0 flex-col">
          {shown.length > 0 && (
            <div>
              <Label>In this issue</Label>
              <ol className="rule-heavy mt-3">
                {shown.map((s, i) => (
                  <li key={i} className="rule-hair first:border-t-0">
                    <Link
                      href={`/read/${number}`}
                      aria-label={`Read this issue: ${s.title}`}
                      className="group/entry flex min-h-12 items-baseline py-2.5"
                    >
                      <span className="text-lead w-8 flex-none font-ui text-[15px] font-bold tabular-nums">
                        {i + 1}.
                      </span>
                      <span className="text-lead min-w-0 font-display text-[20px] leading-snug font-medium group-hover/entry:underline">
                        {s.title}
                      </span>
                      {/* The section name after a dotted leader — from sm up,
                          where a line has room for both. */}
                      {s.kicker && (
                        <>
                          <span aria-hidden className="leader hidden sm:block" />
                          <span className="small-caps text-grey-soft hidden flex-none sm:inline">
                            {s.kicker}
                          </span>
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
              {sections.length > shown.length && (
                <p className="text-grey-soft mt-3 font-ui text-[15px]">
                  and {sections.length - shown.length} more inside
                </p>
              )}
            </div>
          )}

          <div className="mt-auto grid gap-3 pt-8 sm:grid-cols-2">
            <Button href={`/read/${number}`} icon="arrowRight" full>
              Read this issue
            </Button>
            {/* The owner can switch downloads off site-wide (issue #162). This
                is a Server Component, so "off" means the control is never built
                — not hidden with CSS, not decided in the browser. */}
            {settings.pdfDownloads && (
              <DownloadPdfButton issueNumber={number} full />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
