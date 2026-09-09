import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { SourcePage, Region, ReviewItem, SourceMapping } from "./model";
import { sourceState } from "./synthesis";
import type { Page } from "@/lib/blocks";

export function SourcePreview({
  page,
  zoom,
  selected,
  mapping,
  pages,
  onToggle,
}: {
  page: SourcePage;
  zoom: number;
  selected: ReviewItem[];
  mapping: SourceMapping;
  pages: Page[];
  onToggle: (region: Region) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const canvas = page.canvas;
    element.append(canvas);
    return () => {
      canvas.remove();
    };
  }, [page]);
  return (
    <div
      className="scrollbar-soft overflow-auto p-2"
      style={{ maxHeight: "48vh" }}
    >
      <div
        className="relative bg-white"
        style={{
          width: `${zoom}%`,
          minWidth: "100%",
          aspectRatio: `${page.width}/${page.height}`,
        }}
      >
        <div ref={host} className="absolute inset-0" />
        {page.regions.map((r, index) => {
          const chosen = selected.some((item) => item.sources.includes(r.id));
          const imported = sourceState(mapping[r.id] ?? [], pages);
          return (
            <div
              key={r.id}
              className="absolute"
              style={{
                left: `${(r.x / page.width) * 100}%`,
                top: `${(r.y / page.height) * 100}%`,
                width: `${(r.width / page.width) * 100}%`,
                height: `${(r.height / page.height) * 100}%`,
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                aria-label={`${r.kind === "image" ? "Image" : "Text"} region ${index + 1}${chosen ? ", selected" : ""}${imported ? `, ${imported}` : ""}`}
                title={`${r.kind === "image" ? "Image" : "Text"} ${index + 1}`}
                onClick={() => onToggle(r)}
                className={`!h-full !w-full !min-h-0 !rounded-none !p-0 !shadow-none ${chosen ? "!border-accent !bg-accent/20" : imported ? "!border-ok !bg-ok/10" : "!border-transparent !bg-transparent hover:!border-accent hover:!bg-accent/10"}`}
              >
                <span
                  className={
                    chosen || imported
                      ? "bg-card text-ink absolute -top-2 right-0 rounded px-1 text-xs"
                      : "sr-only"
                  }
                >
                  {chosen
                    ? "✓"
                    : imported === "partial"
                      ? "½"
                      : imported
                        ? "Added"
                        : "Select"}
                </span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
