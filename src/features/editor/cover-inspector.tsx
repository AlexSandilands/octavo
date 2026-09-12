import { Button } from "@/components/ui";
import type { BlockPatch, CoverOverlay, Page, PageAlign } from "@/lib/blocks";
import { type CoverElement, type CoverSource } from "@/lib/cover-elements";
import { placementOf } from "@/lib/cover-order";
import type { LogoListItem } from "@/lib/logos";
import type { ResolvedImage } from "@/lib/images";
import { CoverPlacementControls } from "./cover-placement-controls";
import { CoverElementFields } from "./cover-element-fields";
import { CoverImageFields } from "./cover-image-fields";
import { CoverAppearanceControls } from "./cover-appearance-controls";
import { CoverTextFormatControls } from "./cover-text-format-controls";
import { resolveCoverAppearance } from "@/lib/cover-appearance";
import { CoverDecorationControls } from "./cover-decoration-controls";

export type CoverInspectorProps = {
  hasMasthead?: boolean;
  issueId: string;
  onFillPage: (id: string, align: PageAlign) => void;
  page: Page;
  pageNumber: number;
  selectedId: string | null;
  sources: CoverSource[];
  logos: LogoListItem[];
  onUpdate: (element: CoverElement) => void;
  onChange: (value: CoverOverlay) => void;
  onUpdateBlock: (id: string, patch: BlockPatch) => void;
  onRegisterImage: (id: string, image: ResolvedImage) => void;
  overlay: CoverOverlay;
  onSelectImage: () => void;
  warnings: string[];
};
export function CoverInspector({
  hasMasthead,
  issueId,
  onFillPage,
  page,
  pageNumber,
  selectedId,
  sources,
  logos,
  onUpdate,
  onChange,
  onUpdateBlock,
  onRegisterImage,
  overlay,
  onSelectImage,
  warnings,
}: CoverInspectorProps) {
  const image = page.blocks.find(
    (b) => b.id === selectedId && b.type === "image",
  );
  if (page.cover && image?.type === "image")
    return (
      <CoverImageFields
        block={image}
        issueId={issueId}
        onChange={(patch) => onUpdateBlock(image.id, patch)}
        onFillPage={(align) => onFillPage(image.id, align)}
        onRegisterImage={onRegisterImage}
      />
    );
  const element = page.coverElements?.find((e) => e.id === selectedId);
  const block = page.blocks.find(
    (b) => b.id === selectedId && (b.type === "heading" || b.type === "text"),
  );
  const selected = element ?? block;
  const placement = selected ? placementOf(selected, page) : undefined;
  const updatePlacement = (next: NonNullable<typeof placement>) => {
    if (element) onUpdate({ ...element, placement: next });
    else if (block) onUpdateBlock(block.id, { coverPlacement: next });
  };
  const appearance = resolveCoverAppearance(
    placement?.style ?? overlay.style,
    placement?.style
      ? placement.appearance
      : { ...overlay.appearance, ...placement?.appearance },
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {placement && page.cover && (
        <div className="shrink-0 space-y-3 p-4">
          <CoverPlacementControls
            value={placement}
            logo={element?.type === "logo"}
            onChange={updatePlacement}
          />
        </div>
      )}
      {
        <div className="scrollbar-soft border-line min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain border-t p-4 [--scrollbar-surface:var(--color-card)]">
          {placement && (
            <>
              {element?.type !== "logo" && (
                <CoverTextFormatControls appearance={appearance} />
              )}
              <CoverAppearanceControls
                value={appearance}
                style={placement.style ?? overlay.style}
                inherited={!placement.style && !placement.appearance}
                logo={element?.type === "logo"}
                onInherit={(inherit) =>
                  updatePlacement({
                    ...placement,
                    style: undefined,
                    appearance: inherit ? undefined : appearance,
                  })
                }
                onChange={(value) =>
                  updatePlacement({ ...placement, appearance: value })
                }
              />
            </>
          )}
          {!page.cover && (
            <p className="text-muted font-sans text-sm">
              Cover styling is off. These elements follow the page flow; turn on
              Cover page to use their saved positions.
            </p>
          )}
          {element && (
            <CoverElementFields
              element={element}
              sources={sources}
              afterPage={pageNumber}
              logos={logos}
              onChange={onUpdate}
              onRegisterImage={onRegisterImage}
            />
          )}
          {!selected && (
            <>
              <p className="text-muted font-sans text-sm leading-relaxed">
                Select an item on the cover to arrange it. Use its drag handle
                to reorder it, or place it with the position grid.
              </p>
              <div className="space-y-3">
                <h3 className="text-muted font-sans text-xs font-semibold">
                  Default appearance
                </h3>
                <CoverAppearanceControls
                  value={overlay.appearance}
                  style={overlay.style}
                  onChange={(appearance) =>
                    onChange({ ...overlay, appearance })
                  }
                />
                <CoverDecorationControls
                  page={page}
                  value={overlay}
                  hasMasthead={hasMasthead}
                  onChange={onChange}
                />
              </div>
              {page.blocks.some(
                (b) =>
                  b.type === "image" &&
                  (b.align === "page-fill" || b.align === "page-fit"),
              ) && (
                <Button variant="secondary" size="sm" onClick={onSelectImage}>
                  Edit background image
                </Button>
              )}
            </>
          )}
          {warnings.length > 0 && (
            <div
              role="status"
              className="text-warn space-y-2 font-sans text-xs leading-relaxed"
            >
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
        </div>
      }
    </div>
  );
}
