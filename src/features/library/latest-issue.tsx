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
  const month = issueMonth(publishedAt);
  const sections = issueSections(content);
  return (
    <section className="folio-feature" aria-label="Latest issue">
      <div className="folio-feature-intro">
        <Kicker>Fresh from the press</Kicker>
        <p className="folio-issue-number">
          Issue {String(number).padStart(2, "0")} <span> / {month}</span>
        </p>
        <h2>{title}</h2>
        <p className="folio-feature-note">
          {content.pages.length} pages to settle into.
          <br />
          Made for members. Read at your own pace.
        </p>
        <div className="folio-feature-actions">
          <Button href={`/read/${number}`} icon="arrowRight">
            Read this issue
          </Button>
          {settings.pdfDownloads && <DownloadPdfButton issueNumber={number} />}
        </div>
      </div>
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="folio-feature-cover"
      >
        {cover ? (
          <CoverThumb
            page={cover}
            theme={theme}
            images={images}
            sponsors={sponsors}
            issueNo={number}
            settings={settings}
            width={260}
            priority
          />
        ) : (
          <div className="photo-fill-green h-[366px] p-6 text-paper font-serif text-4xl">
            {title}
          </div>
        )}
      </Link>
      <div className="folio-feature-contents">
        <Label>Inside this edition</Label>
        <ol>
          {sections.slice(0, 4).map((section, i) => (
            <li key={i}>
              <Link
                href={`/read/${number}`}
                aria-label={`Read this issue: ${section.title}`}
              >
                <span className="folio-content-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {section.kicker && <small>{section.kicker}</small>}
                  <strong>{section.title}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {sections.length > 4 && (
          <p className="text-muted mt-4 font-serif italic">
            And {sections.length - 4} more inside.
          </p>
        )}
      </div>
    </section>
  );
}
