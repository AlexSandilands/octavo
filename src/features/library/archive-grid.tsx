import { Label } from "@/components/ui";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { CoverCard, type CoverItem } from "./cover-card";

type YearGroup = { key: string; label: string; items: CoverItem[] };

// Bucket the back catalogue by publication year, newest year first. Undated
// issues (no publishedAt yet) fall into a trailing group so none disappear.
function groupByYear(items: CoverItem[]): YearGroup[] {
  const byYear = new Map<number, CoverItem[]>();
  const undated: CoverItem[] = [];
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

// The back catalogue as shelves of lit covers on the dark ground, one shelf
// per year so the archive reads as a run of volumes rather than a pile.
export function ArchiveGrid({
  items,
  images,
  sponsors,
  settings,
}: {
  items: CoverItem[];
  images: ImageMap;
  /** Resolved managed sponsors for the cover pages — the thumbnail needs them
   *  to draw a sponsor block the same way the reader does (issue #170). */
  sponsors: SponsorMap;
  /** Branding for the cover decoration; covers carry no footer. */
  settings: SiteSettings;
}) {
  const groups = groupByYear(items);
  return (
    <section className="space-y-12 pb-9">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="border-hairline border-b pb-3">
            <Label tone="dark">{group.label}</Label>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-9">
            {group.items.map((a, idx) => (
              <CoverCard
                key={a.id}
                item={a}
                index={idx}
                images={images}
                sponsors={sponsors}
                settings={settings}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
