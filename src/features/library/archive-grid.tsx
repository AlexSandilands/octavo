import Link from "next/link";
import { Label } from "@/components/ui";

const ARCHIVE_TINTS = ["#cdbfa6", "#9fb0a6", "#c2a99a", "#b3aec0"];

function stripes(tint: string) {
  return `repeating-linear-gradient(135deg, ${tint} 0, ${tint} 10px, #00000010 10px, #00000010 20px)`;
}

type ArchiveItem = {
  id: string;
  number: number;
  title: string;
  publishedAt: Date | null;
};

// The back catalogue: each spine carries a large ghosted issue numeral and lifts
// on hover, so the grid reads as a shelf of issues rather than flat swatches.
export function ArchiveGrid({ items }: { items: ArchiveItem[] }) {
  return (
    <section className="py-9">
      <Label>The archive</Label>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4">
        {items.map((a, idx) => {
          const tint = ARCHIVE_TINTS[idx % ARCHIVE_TINTS.length] ?? "#cdbfa6";
          const year = a.publishedAt?.getFullYear() ?? null;
          return (
            <Link key={a.id} href={`/read/${a.number}`} className="group">
              <div
                className="relative h-[150px] overflow-hidden rounded-[5px] shadow-[0_2px_10px_-5px_rgba(20,32,28,0.3)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_14px_28px_-10px_rgba(20,32,28,0.4)]"
                style={{ backgroundImage: stripes(tint) }}
              >
                <span className="pointer-events-none absolute -right-1 -bottom-5 font-serif text-[92px] leading-none text-[#2f2b22]/15 select-none">
                  {a.number}
                </span>
                <span className="absolute top-3 left-3 font-serif text-xs text-[#3a372f]/80">
                  No. {a.number}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="text-ink font-serif text-[15px] leading-tight group-hover:underline">
                  {a.title}
                </span>
                {year && (
                  <span className="text-faint2 flex-none font-sans text-[11px]">
                    {year}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
