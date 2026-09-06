import Link from "next/link";
import { coverPageOf, type Page } from "@/lib/blocks";
import type { IssueRow } from "@/server/issues";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { CoverThumb } from "./cover-thumb";
import { issueMonth } from "./contents";

// A curated set of muted cover tints — decorative variety for legacy issues
// with no real cover page. Local data (indexed by card position), not part of
// the semantic token palette, so kept as literals here.
const ARCHIVE_TINTS = ["#c9d0e3", "#b8cdd9", "#d3c9d9", "#c3d6cc"];
// The cover inside a card. The card is the thumb plus its padding, so two fit
// beside each other on a 390px phone and four across the desktop column.
const THUMB_W = 144;

function stripes(tint: string) {
  // #00000010 = 6% black, a tint-agnostic diagonal shade over whatever cover
  // colour is passed; deliberately generic, so it stays inline in the gradient.
  return `repeating-linear-gradient(135deg, ${tint} 0, ${tint} 10px, #00000010 10px, #00000010 20px)`;
}

type ArchiveItem = {
  id: string;
  number: number;
  title: string;
  publishedAt: Date | null;
  theme: string;
  cover?: Page;
};

// Issue rows as shelf cards — one mapping for the home page and /archive, so
// both draw the same card from the same columns.
export function toArchiveItems(rows: IssueRow[]): ArchiveItem[] {
  return rows.map((i) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    publishedAt: i.publishedAt,
    theme: i.theme,
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

// The back catalogue as a grid of issue cards, grouped by year. Each card is
// one link — cover, title, number and month, and a Read pill that says what a
// press does — so the whole card is the target.
export function ArchiveGrid({
  items,
  images,
  sponsors,
  settings,
  heading = "Recent issues",
}: {
  items: ArchiveItem[];
  images: ImageMap;
  /** Resolved managed sponsors for the cover pages — the thumbnail needs them
   *  to draw a sponsor block the same way the reader does (issue #170). */
  sponsors: SponsorMap;
  /** Branding for the cover decoration; covers carry no footer. */
  settings: SiteSettings;
  /** null on a page that already names the shelf in its own heading. */
  heading?: string | null;
}) {
  const groups = groupByYear(items);
  return (
    <section aria-label={heading ?? "Issues"}>
      {heading && (
        <h2 className="text-fg font-ui text-[22px] font-bold">{heading}</h2>
      )}
      <div className={`flex flex-col gap-8 ${heading ? "mt-4" : ""}`}>
        {groups.map((group) => (
          <div key={group.key}>
            <h3 className="text-fg-muted font-ui text-[15px] font-bold tracking-[0.08em] uppercase">
              {group.label}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-3 sm:gap-4">
              {group.items.map((a, idx) => (
                <li key={a.id}>
                  <ArchiveCard
                    item={a}
                    index={idx}
                    images={images}
                    sponsors={sponsors}
                    settings={settings}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// One issue card. The tint only shows for legacy issues without a cover page;
// it cycles the palette by the card's position within its year.
function ArchiveCard({
  item: a,
  index,
  images,
  sponsors,
  settings,
}: {
  item: ArchiveItem;
  index: number;
  images: ImageMap;
  sponsors: SponsorMap;
  settings: SiteSettings;
}) {
  const tint = ARCHIVE_TINTS[index % ARCHIVE_TINTS.length] ?? "#c9d0e3";
  const month = issueMonth(a.publishedAt);
  return (
    <Link
      href={`/read/${a.number}`}
      aria-label={`Read ${a.title}`}
      className="group bg-surface border-hairline shadow-card hover:border-primary flex w-[164px] flex-col rounded-card border p-2.5 transition-[border-color,transform] duration-200 motion-safe:hover:-translate-y-0.5"
    >
      <div className="overflow-hidden rounded-[8px]">
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
          <PlaceholderCover number={a.number} tint={tint} />
        )}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3 pb-1">
        <span className="text-fg line-clamp-2 font-ui text-[16px] leading-snug font-bold">
          {a.title}
        </span>
        <span className="text-fg-muted mt-1 font-ui text-[14px]">
          No. {a.number}
          {month ? ` · ${month}` : ""}
        </span>
        <span
          aria-hidden="true"
          className="bg-primary-soft text-primary group-hover:bg-primary group-hover:text-surface mt-3 flex h-10 items-center justify-center rounded-full font-ui text-[15px] font-bold transition-colors"
        >
          Read
        </span>
      </div>
    </Link>
  );
}

// Portrait fallback for issues without a cover page: a tinted stripe field with
// a large ghosted issue numeral. Matches the cover thumbnail's aspect ratio.
function PlaceholderCover({ number, tint }: { number: number; tint: string }) {
  return (
    <div
      className="relative"
      style={{
        width: THUMB_W,
        height: Math.round((THUMB_W * PAGE_H) / PAGE_W),
        backgroundImage: stripes(tint),
      }}
    >
      {/* Ghosted numeral + label over the tinted stripe field: near-ink at low
          opacity, decorative to this placeholder cover only — not tokens. */}
      <span className="text-fg/15 pointer-events-none absolute -right-1 -bottom-6 font-ui text-[110px] leading-none font-bold select-none">
        {number}
      </span>
      <span className="text-fg/80 absolute top-3 left-3 font-ui text-xs font-bold">
        No. {number}
      </span>
    </div>
  );
}
