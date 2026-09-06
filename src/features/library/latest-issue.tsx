import Link from "next/link";
import { Button, Chip, Kicker } from "@/components/ui";
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

const COVER_W = 200;

// The latest-issue card: the cover at left, the title, the issue's facts, the
// first sections as chips, and one big Read button.
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
    <section
      aria-labelledby="latest-issue-title"
      className="bg-surface border-hairline shadow-card grid gap-6 rounded-card border p-5 sm:grid-cols-[200px_1fr] sm:gap-8 sm:p-7"
    >
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="group block w-[200px] justify-self-center rounded-[10px] sm:justify-self-start"
      >
        <div className="shadow-float overflow-hidden rounded-[10px] transition-transform duration-300 motion-safe:group-hover:-translate-y-1">
          {cover ? (
            <CoverThumb
              page={cover}
              theme={theme}
              images={images}
              sponsors={sponsors}
              issueNo={number}
              settings={settings}
              width={COVER_W}
              priority
            />
          ) : (
            // Legacy issues without a cover page keep the stylised book panel.
            <div className="photo-fill-green relative flex h-[280px] flex-col justify-between p-5">
              <div className="absolute inset-y-0 left-0 w-[7px] bg-black/20" />
              <div className="text-cream font-serif text-[13px] tracking-[0.1em]">
                {settings.name} · No. {number}
              </div>
              <div className="text-paper font-serif text-3xl leading-[0.96]">
                {title}
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-col">
        <Kicker>Latest issue</Kicker>
        <h2
          id="latest-issue-title"
          className="text-fg mt-2 font-ui text-[28px] leading-[1.1] font-bold sm:text-[34px]"
        >
          {title}
        </h2>
        <p className="text-fg-muted mt-2 font-ui text-[16px]">
          No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
          {month ? ` · ${month}` : ""}
        </p>

        {shown.length > 0 && (
          <ul aria-label="In this issue" className="mt-4 flex flex-wrap gap-2">
            {shown.map((s, i) => (
              <li key={i} className="max-w-full">
                <Chip>{s.title}</Chip>
              </li>
            ))}
            {sections.length > shown.length && (
              <li>
                <Chip>+ {sections.length - shown.length} more</Chip>
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
          <Button href={`/read/${number}`} icon="reader" size="lg">
            Read issue
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
