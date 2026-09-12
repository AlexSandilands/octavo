import type { BlockPatch, CoverOverlay, Page, PageAlign } from "@/lib/blocks";
import { type CoverElement, type CoverSource } from "@/lib/cover-elements";
import { itemAppearance, placementOf } from "@/lib/cover-order";
import type { LogoListItem } from "@/lib/logos";
import type { ResolvedImage } from "@/lib/images";
import { CoverPlacementControls } from "./cover-placement-controls";
import { CoverElementFields } from "./cover-element-fields";
import { CoverImageDetails, CoverImagePlacement } from "./cover-image-fields";
import { CoverAppearanceControls } from "./cover-appearance-controls";
import { CoverDecorationControls } from "./cover-decoration-controls";
import { CoverWarnings } from "./cover-warnings";
import { InspectorSection } from "./cover-fields";
import type { CoverWarning } from "./use-cover-layout-warnings";

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
  onSelect: (id: string | null) => void;
  /** Light up these items on the page while a warning is pointed at. */
  onHint: (ids: string[]) => void;
  warnings: CoverWarning[];
};

const CONTENT_TITLES = {
  contents: "Sections",
  teaser: "Story",
  details: "Details",
  logo: "Logo",
} as const;

// Whole-item settings, top to bottom: where it sits, how it paints, what it
// says. Formatting for selected words is the floating bar on the page.
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
  onSelect,
  onHint,
  warnings,
}: CoverInspectorProps) {
  const image = page.blocks.find(
    (b) => b.id === selectedId && b.type === "image",
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
  const checks = warnings.length > 0 && (
    <InspectorSection title="Needs attention">
      <CoverWarnings warnings={warnings} onHint={onHint} onSelect={onSelect} />
    </InspectorSection>
  );
  const scroll =
    "scrollbar-soft border-line min-h-0 flex-1 overflow-y-auto overscroll-contain [--scrollbar-surface:var(--color-card)]";
  // Placement is pinned above the scrolling rest, so the position grid stays
  // in reach while a long content section is being edited.
  if (page.cover && image?.type === "image") {
    const props = {
      block: image,
      page,
      issueId,
      onChange: (patch: BlockPatch) => onUpdateBlock(image.id, patch),
      onFillPage: (align: PageAlign) => onFillPage(image.id, align),
      onRegisterImage,
    };
    return (
      <>
        <div className="shrink-0">
          <CoverImagePlacement {...props} />
        </div>
        <div className={`${scroll} border-t`}>
          <CoverImageDetails {...props} />
          {checks}
        </div>
      </>
    );
  }
  if (selected && placement)
    return (
      <>
        <div className="shrink-0">
          {page.cover ? (
            <InspectorSection title="Placement">
              <CoverPlacementControls
                value={placement}
                variant={element?.type === "logo" ? "logo" : "text"}
                onChange={updatePlacement}
              />
            </InspectorSection>
          ) : (
            <InspectorSection>
              <p className="text-muted font-sans text-sm leading-relaxed">
                Cover styling is off. These items follow the page flow; turn on
                Cover page to use their saved positions.
              </p>
            </InspectorSection>
          )}
        </div>
        <div className={`${scroll} border-t`}>
          {page.cover && (
            <InspectorSection title="Appearance">
              <CoverAppearanceControls
                value={itemAppearance(selected, page)}
                style={placement.style ?? overlay.style}
                inherited={!placement.style && !placement.appearance}
                panelOnly={element?.type === "logo"}
                onInherit={(inherit) =>
                  updatePlacement({
                    ...placement,
                    style: undefined,
                    appearance: inherit
                      ? undefined
                      : itemAppearance(selected, page),
                  })
                }
                onChange={(appearance) =>
                  updatePlacement({ ...placement, appearance })
                }
              />
            </InspectorSection>
          )}
          {element && (
            <InspectorSection title={CONTENT_TITLES[element.type]}>
              <CoverElementFields
                element={element}
                sources={sources}
                afterPage={pageNumber}
                logos={logos}
                onChange={onUpdate}
                onRegisterImage={onRegisterImage}
              />
            </InspectorSection>
          )}
          {checks}
        </div>
      </>
    );
  return (
    <div className={scroll}>
      <InspectorSection>
        <p className="text-muted font-sans text-sm leading-relaxed">
          Select an item on the cover to arrange it. The settings below are the
          cover’s defaults; any item can depart from them.
        </p>
      </InspectorSection>
      {page.cover && (
        <>
          <InspectorSection title="Default appearance">
            <CoverAppearanceControls
              value={overlay.appearance}
              style={overlay.style}
              onChange={(appearance) => onChange({ ...overlay, appearance })}
            />
          </InspectorSection>
          <InspectorSection title="Page">
            <CoverDecorationControls
              page={page}
              value={overlay}
              hasMasthead={hasMasthead}
              onChange={onChange}
            />
          </InspectorSection>
        </>
      )}
      {checks}
    </div>
  );
}
