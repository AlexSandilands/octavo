import Link from "next/link";
import { Label } from "@/components/ui";
import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { CoverThumb } from "./cover-thumb";

const ARCHIVE_TINTS = ["#cdbfa6", "#9fb0a6", "#c2a99a", "#b3aec0"];
const THUMB_W = 150;

function stripes(tint: string) {
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

// The back catalogue as a shelf of magazine covers, grouped by year so the
// archive reads as a run of volumes rather than an undifferentiated pile. Each
// card renders the issue's real cover page (falling back to a tinted, numbered
// spine for legacy issues with no cover), lifting on hover.
export function ArchiveGrid({
  items,
  images,
}: {
  items: ArchiveItem[];
  images: ImageMap;
}) {
  const groups = groupByYear(items);
  return (
    <section className="py-9">
      <Label>The archive</Label>
      <div className="mt-6 space-y-9">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="border-line-soft border-t pt-3">
              <Label>{group.label}</Label>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-7">
              {group.items.map((a, idx) => (
                <ArchiveCard key={a.id} item={a} index={idx} images={images} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// One cover in the shelf. The tint only shows for legacy issues without a cover
// page; it cycles the palette by the card's position within its year.
function ArchiveCard({
  item: a,
  index,
  images,
}: {
  item: ArchiveItem;
  index: number;
  images: ImageMap;
}) {
  const tint = ARCHIVE_TINTS[index % ARCHIVE_TINTS.length] ?? "#cdbfa6";
  return (
    <Link
      href={`/read/${a.number}`}
      className="group"
      style={{ width: THUMB_W }}
    >
      <div className="overflow-hidden rounded-[5px] shadow-[0_2px_10px_-5px_rgba(20,32,28,0.3)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_14px_28px_-10px_rgba(20,32,28,0.4)]">
        {a.cover ? (
          <CoverThumb
            page={a.cover}
            theme={a.theme}
            images={images}
            issueNo={a.number}
            width={THUMB_W}
          />
        ) : (
          <PlaceholderCover number={a.number} tint={tint} />
        )}
      </div>
      <div className="mt-2.5">
        <span className="text-ink font-serif text-[15px] leading-tight group-hover:underline">
          {a.title}
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
      <span className="pointer-events-none absolute -right-1 -bottom-6 font-serif text-[110px] leading-none text-[#2f2b22]/15 select-none">
        {number}
      </span>
      <span className="absolute top-3 left-3 font-serif text-xs text-[#3a372f]/80">
        No. {number}
      </span>
    </div>
  );
}
