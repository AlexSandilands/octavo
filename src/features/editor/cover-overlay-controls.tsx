import { Button } from "@/components/ui";
import { DEFAULT_COVER_OVERLAY, type Page } from "@/lib/blocks";
import { COVER_ELEMENT_LABELS, coverSources } from "@/lib/cover-elements";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { CoverInspector, type CoverInspectorProps } from "./cover-inspector";

type Props = Omit<
  CoverInspectorProps,
  "page" | "sources" | "overlay" | "pageNumber"
> & {
  page?: Page;
  pages: Page[];
  onSelect: (id: string | null) => void;
};
/** A reserved column, outside the pan/zoom stage. Selecting never obscures the page. */
export function CoverOverlayControls({
  page,
  pages,
  onSelect,
  ...props
}: Props) {
  if (!page) return null;
  const element = page.coverElements?.find((e) => e.id === props.selectedId);
  const block = page.blocks.find(
    (b) =>
      b.id === props.selectedId &&
      (b.type === "heading" ||
        b.type === "text" ||
        (page.cover && b.type === "image")),
  );
  const selected = Boolean(element || block);
  const overlay =
    page.coverOverlay ??
    (pageFillsCanvas(page)
      ? DEFAULT_COVER_OVERLAY
      : { ...DEFAULT_COVER_OVERLAY, style: "dark" as const });
  return (
    <div className="relative z-10 flex w-[300px] shrink-0 items-start px-3 pt-5 pb-[92px] lg:w-[320px] xl:w-[344px]">
      <aside
        aria-label="Cover element settings"
        className="border-hair-warm bg-card flex max-h-full w-full flex-col overflow-hidden rounded-[14px] border shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--color-ink)_14%,transparent)]"
      >
        <div className="border-line flex h-16 shrink-0 items-center justify-between border-b px-4">
          <h2 className="font-serif text-lg">
            {element
              ? COVER_ELEMENT_LABELS[element.type]
              : block?.type === "heading"
                ? "Heading"
                : block?.type === "image"
                  ? "Image"
                  : block
                    ? "Text"
                    : "Cover"}
          </h2>
          {selected && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelect(null)}
            >
              Done
            </Button>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <CoverInspector
            key={props.selectedId ?? "cover"}
            {...props}
            page={page}
            overlay={overlay}
            pageNumber={pages.findIndex((p) => p.id === page.id) + 1}
            sources={coverSources(pages)}
          />
        </div>
      </aside>
    </div>
  );
}
