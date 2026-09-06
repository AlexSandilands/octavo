import Link from "next/link";
import { Label } from "@/components/ui";
import { coverPageOf, type Page } from "@/lib/blocks";
import type { IssueRow } from "@/server/issues";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { CoverThumb } from "./cover-thumb";
import { DownloadPdfButton } from "./download-pdf-button";
import { issueMonth } from "./contents";

const THUMB_W = 72;

type ArchiveItem = {
  id: string;
  number: number;
  title: string;
  publishedAt: Date | null;
  theme: string;
  pages: number;
  cover?: Page;
};

// Issue rows as list items — one mapping for the home page and /archive, so
// both draw the same row from the same columns.
export function toArchiveItems(rows: IssueRow[]): ArchiveItem[] {
  return rows.map((i) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    publishedAt: i.publishedAt,
    theme: i.theme,
    pages: i.content.pages.length,
    cover: coverPageOf(i.content),
  }));
}

type YearGroup = { key: string; label: string; items: ArchiveItem[] };

// Bucket the back catalogue by publication year, newest year first. Undated
// issues (no publishedAt yet) fall into a trailing group so none disappear.
function groupByYear(items: ArchiveItem[]): YearGroup[] {
  const byYear = new Map<number, ArchiveItem[]>();
  const undated: ArchiveItem[] = [];
  for (const item of items) {
    const year = item.publishedAt?.getFullYear();
    if (year == null) {
      undated.push(item);
      continue;
    }
    const bucket = byYear.get(year) ?? [];
    bucket.push(item);
    byYear.set(year, bucket);
  }
  const groups: YearGroup[] = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({
      key: String(year),
      label: String(year),
      items: list,
    }));
  if (undated.length) {
    groups.push({ key: "undated", label: "Undated", items: undated });
  }
  return groups;
}

// The back catalogue as a list, not a grid: one rule-separated row per issue
// (a small cover, the number in bold, the title as a serif link, month and
// length, and a PDF link at the right), under small-caps year headings.
export function BackIssues({
  items,
  images,
  sponsors,
  settings,
  heading,
}: {
  items: ArchiveItem[];
  images: ImageMap;
  /** Resolved managed sponsors for the cover pages — the thumbnail needs them
   *  to draw a sponsor block the same way the reader does (issue #170). */
  sponsors: SponsorMap;
  /** Branding for the cover decoration; covers carry no footer. */
  settings: SiteSettings;
  /** null on a page that already names the list in its own heading. */
  heading: string | null;
}) {
  const groups = groupByYear(items);
  return (
    <section className="pb-8">
      {heading && (
        <h2 className="rule-heavy text-lead pt-3 font-display text-[30px] font-semibold">
          {heading}
        </h2>
      )}
      <div className={heading ? "mt-5 space-y-8" : "space-y-8"}>
        {groups.map((group) => (
          <div key={group.key}>
            <div className="rule-heavy pt-2">
              <Label>{group.label}</Label>
            </div>
            <ol className="mt-1">
              {group.items.map((a) => (
                <BackIssueRow
                  key={a.id}
                  item={a}
                  images={images}
                  sponsors={sponsors}
                  settings={settings}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

// One row. A single link — cover, number, title, meta and "Read" together —
// so the row has one target, plus the PDF control beside it when downloads are
// on. Every surface that lists issues wraps the cover render in exactly one
// <a href="/read/…"> (the thumb itself emits none: cover-thumb.tsx).
function BackIssueRow({
  item: a,
  images,
  sponsors,
  settings,
}: {
  item: ArchiveItem;
  images: ImageMap;
  sponsors: SponsorMap;
  settings: SiteSettings;
}) {
  const month = issueMonth(a.publishedAt);
  return (
    <li className="rule-hair flex items-center gap-3 py-3 sm:gap-5">
      <Link
        href={`/read/${a.number}`}
        aria-label={`Read ${a.title}`}
        className="group flex min-w-0 flex-1 items-center gap-4 rounded-ui sm:gap-5"
      >
        <span className="border-lead block flex-none overflow-hidden border">
          {a.cover ? (
            <CoverThumb
              page={a.cover}
              theme={a.theme}
              images={images}
              sponsors={sponsors}
              issueNo={a.number}
              settings={settings}
              width={THUMB_W}
            />
          ) : (
            <PlaceholderCover number={a.number} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-lead block font-ui text-[14px] font-bold tabular-nums">
            No. {a.number}
          </span>
          <span className="text-lead block font-display text-[21px] leading-tight font-medium group-hover:underline">
            {a.title}
          </span>
          <span className="text-grey block font-ui text-[15px] tabular-nums">
            {month ? `${month} · ` : ""}
            {a.pages} {a.pages === 1 ? "page" : "pages"}
          </span>
        </span>
        <span className="text-red hidden flex-none font-ui text-[16px] font-semibold underline decoration-1 underline-offset-4 group-hover:decoration-2 sm:inline">
          Read →
        </span>
      </Link>
      {settings.pdfDownloads && (
        <DownloadPdfButton issueNumber={a.number} variant="link" />
      )}
    </li>
  );
}

// Portrait fallback for issues without a cover page: a ruled box with the
// issue number, matching the cover thumbnail's aspect ratio.
function PlaceholderCover({ number }: { number: number }) {
  return (
    <span
      className="bg-newsprint text-grey flex items-center justify-center font-display text-[22px] font-semibold"
      style={{
        width: THUMB_W,
        height: Math.round((THUMB_W * PAGE_H) / PAGE_W),
      }}
    >
      {number}
    </span>
  );
}
