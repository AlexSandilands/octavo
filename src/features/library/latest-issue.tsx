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

const COVER_W = 260;

// The library hero: the cover as a lit object on the dark ground, and an
// editorial "in this issue" teaser beside it so the latest issue sells itself.
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
    <section className="grid gap-10 py-12 md:grid-cols-[260px_1fr] md:gap-14 md:py-16">
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="group rounded-ui block self-start justify-self-center md:justify-self-start"
        style={{ width: COVER_W }}
      >
        <div className="shadow-glow overflow-hidden rounded-[5px] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none">
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
            <div className="photo-fill-green relative flex h-[366px] flex-col justify-between p-5">
              <div className="absolute inset-y-0 left-0 w-[7px] bg-black/20" />
              <div className="absolute inset-y-0 left-[7px] w-px bg-white/10" />
              <div className="text-cream font-meta text-[12px] tracking-[0.1em] uppercase">
                {settings.name} · No. {number}
              </div>
              <div className="text-paper font-display text-4xl leading-[0.96]">
                {title}
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col">
        <Kicker tone="dark">The latest issue</Kicker>
        {/* h2: the page's single h1 is the masthead standfirst (see page.tsx). */}
        <h2 className="text-chrome-text mt-3 font-display text-[36px] leading-[1.05] sm:text-[48px]">
          {title}
        </h2>
        <div className="text-chrome-muted mt-3 font-meta text-[13px] tracking-[0.08em] uppercase">
          No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
          {month ? ` · ${month}` : ""}
        </div>

        {shown.length > 0 && (
          <div className="border-hairline mt-7 border-t pt-5">
            <Label tone="dark">In this issue</Label>
            <ol className="mt-2">
              {shown.map((s, i) => (
                <li key={i} className="border-hairline border-b last:border-0">
                  <Link
                    href={`/read/${number}`}
                    aria-label={`Read this issue: ${s.title}`}
                    className="group/entry rounded-ui flex min-h-12 items-baseline gap-3.5 py-3"
                  >
                    <span className="text-brass w-6 flex-none font-meta text-[12px] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-chrome-text font-display text-[18px] leading-snug group-hover/entry:underline">
                      {s.title}
                    </span>
                    {s.kicker && (
                      <span className="text-chrome-muted ml-auto hidden flex-none pl-3 font-meta text-[11px] tracking-[0.14em] uppercase sm:inline">
                        {s.kicker}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
            {sections.length > shown.length && (
              <div className="text-chrome-muted mt-3 font-display text-[15px] italic">
                + {sections.length - shown.length} more
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
          <Button href={`/read/${number}`} icon="arrowRight" size="lg">
            Read this issue
          </Button>
          {/* The owner can switch downloads off site-wide (issue #162). This is
              a Server Component, so "off" means the control is never built —
              not hidden with CSS, not decided in the browser. */}
          {settings.pdfDownloads && (
            <DownloadPdfButton issueNumber={number} tone="dark" />
          )}
        </div>
      </div>
    </section>
  );
}
