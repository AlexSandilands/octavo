import Link from "next/link";
import { coverPageOf, type Page } from "@/lib/blocks";
import type { IssueRow } from "@/server/issues";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { CoverThumb } from "./cover-thumb";

export const THUMB_W = 150;

export type CoverItem = {
  id: string;
  number: number;
  title: string;
  publishedAt: Date | null;
  theme: string;
  cover?: Page;
};

// Issue rows as shelf items — one mapping for the home shelf and /archive, so
// both draw the same card from the same columns.
export function toCoverItems(rows: IssueRow[]): CoverItem[] {
  return rows.map((i) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    publishedAt: i.publishedAt,
    theme: i.theme,
    cover: coverPageOf(i.content),
  }));
}

// A curated set of muted cover tints — decorative variety for legacy issues
// with no real cover page. Local data (indexed by card position), not part of
// the semantic token palette, so kept as literals here.
const TINTS = ["#cdbfa6", "#9fb0a6", "#c2a99a", "#b3aec0"];

function stripes(tint: string) {
  // #00000010 = 6% black, a tint-agnostic diagonal shade over whatever cover
  // colour is passed; deliberately generic, so it stays inline in the gradient.
  return `repeating-linear-gradient(135deg, ${tint} 0, ${tint} 10px, #00000010 10px, #00000010 20px)`;
}

// One lit cover on the dark ground: the issue's real cover page (or a tinted,
// numbered spine for a legacy issue with no cover), the title under it in the
// display face and the number as a shelf tag. The whole card is the link, so
// the thumbnail render inside it must emit no <a> of its own (issue #166).
export function CoverCard({
  item: a,
  index,
  images,
  sponsors,
  settings,
  year = false,
}: {
  item: CoverItem;
  index: number;
  images: ImageMap;
  sponsors: SponsorMap;
  settings: SiteSettings;
  /** Print the year beside the number (the shelf, which has no year groups). */
  year?: boolean;
}) {
  const tint = TINTS[index % TINTS.length] ?? "#cdbfa6";
  const when = year && a.publishedAt ? ` · ${a.publishedAt.getFullYear()}` : "";
  return (
    <Link
      href={`/read/${a.number}`}
      className="group rounded-ui block flex-none snap-start"
      style={{ width: THUMB_W }}
    >
      <div className="shadow-glow-sm overflow-hidden rounded-[4px] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none">
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
      <div className="mt-3.5">
        <div className="text-chrome-text font-display text-[15px] leading-snug group-hover:underline">
          {a.title}
        </div>
        <div className="text-chrome-muted mt-1 font-meta text-[11px] tracking-[0.1em] whitespace-nowrap uppercase">
          No. {a.number}
          {when}
        </div>
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
      {/* Ghosted numeral + label over the tinted stripe field: near-ink browns at
          low opacity, decorative to this placeholder cover only — not tokens. */}
      <span className="pointer-events-none absolute -right-1 -bottom-6 font-display text-[110px] leading-none text-[#2f2b22]/15 select-none">
        {number}
      </span>
      <span className="absolute top-3 left-3 font-display text-xs text-[#3a372f]/80">
        No. {number}
      </span>
    </div>
  );
}
