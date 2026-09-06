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

// The current issue pairs a reading invitation with the original authored cover.
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
    <section className="harbour-latest">
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="harbour-cover group relative block w-[240px]"
      >
        {/* Stacked page edges peeking out behind the cover. */}
        <div className="bg-hair absolute inset-y-2 -right-[3px] w-[3px] rounded-r-[3px]" />
        <div className="bg-line-soft absolute inset-y-1 -right-[6px] w-[3px] rounded-r-[3px]" />
        <div className="relative overflow-hidden rounded-[5px] shadow-[0_18px_38px_-14px_rgba(20,40,33,0.45)] transition-transform duration-300 group-hover:-translate-y-1">
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

      <div className="harbour-latest-details flex flex-col">
        <Kicker>Fresh from the club</Kicker>
        {/* h2: the page's single h1 is the masthead standfirst (see page.tsx). */}
        <h2 className="text-ink mt-3 font-sans text-[30px] font-semibold leading-[1.12] tracking-tight sm:text-[36px]">
          {title}
        </h2>
        <div className="text-faint mt-3 font-sans text-[13px] tracking-wide">
          No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
          {month ? ` · ${month}` : ""}
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
                    <span className="text-accent w-5 flex-none font-mono text-[11px] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink font-sans text-[16px] font-medium leading-snug group-hover/entry:underline">
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
