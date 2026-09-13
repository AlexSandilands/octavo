import type { Block, BlockPatch, Page, PageAlign } from "@/lib/blocks";
import type { ResolvedImage } from "@/lib/images";
import { coverOverlayOf, itemAppearance, placementOf } from "@/lib/cover-order";
import { isFillPage } from "@/features/blocks/layout";
import { CoverField, InspectorSection } from "./cover-fields";
import { Segments } from "./cover-segments";
import { CoverPlacementControls } from "./cover-placement-controls";
import { CoverAppearanceControls } from "./cover-appearance-controls";
import { ImageBlockControl } from "./image-upload";
import type { InspectorBand } from "./use-inspector-band";

const SIZES = [
  { value: "33", label: "S", name: "small" },
  { value: "50", label: "M", name: "medium" },
  { value: "66", label: "L", name: "large" },
  { value: "100", label: "Full", name: "full width" },
];

type Props = {
  block: Extract<Block, { type: "image" }>;
  page: Page;
  issueId: string;
  onChange: (patch: BlockPatch) => void;
  onFillPage: (align: PageAlign) => void;
  onRegisterImage: (id: string, image: ResolvedImage) => void;
};

/** How a cover photo sits: normal / fill / fit, then size and position. Pinned
 *  above the scroll, and folded away by the same shared band as a text item's. */
export function CoverImagePlacement({
  block,
  page,
  onChange,
  onFillPage,
  band,
}: Props & { band: InspectorBand }) {
  if (!block.imageId) return null;
  const owned = isFillPage(block);
  return (
    <InspectorSection title="Placement" collapsible={band}>
      <Segments
        label="Placement"
        value={owned ? (block.align as PageAlign) : "normal"}
        options={[
          { value: "normal", label: "Normal" },
          { value: "page-fill", label: "Fill page", name: "fill page" },
          { value: "page-fit", label: "Fit page", name: "fit page" },
        ]}
        onChange={(v) =>
          v === "normal" ? onChange({ align: "full" }) : onFillPage(v)
        }
      />
      {owned ? (
        <p className="text-muted font-sans text-xs leading-relaxed">
          {block.align === "page-fill"
            ? "Fill page trims the photo to the page's shape."
            : "Fit page shows the whole photo, with page-coloured bars."}{" "}
          Everything else on the cover sits over it.
        </p>
      ) : (
        <>
          <Segments
            label="Size"
            value={String(block.width ?? 100)}
            options={SIZES}
            onChange={(v) => onChange({ width: Number(v) })}
          />
          <CoverPlacementControls
            variant="image"
            value={placementOf(block, page)}
            onChange={(coverPlacement) => onChange({ coverPlacement })}
          />
        </>
      )}
    </InspectorSection>
  );
}

/** The rest of a cover photo's inspector: its panel, the photo itself, its description. */
export function CoverImageDetails({
  block,
  page,
  issueId,
  onChange,
  onRegisterImage,
}: Props) {
  const placement = placementOf(block, page);
  return (
    <>
      {block.imageId && !isFillPage(block) && (
        <InspectorSection title="Appearance">
          <CoverAppearanceControls
            panelOnly
            value={itemAppearance(block, page)}
            style={placement.style ?? coverOverlayOf(page).style}
            onChange={(appearance) =>
              onChange({ coverPlacement: { ...placement, appearance } })
            }
          />
        </InspectorSection>
      )}
      <InspectorSection title="Photo">
        <ImageBlockControl
          issueId={issueId}
          hasImage={Boolean(block.imageId)}
          onUploaded={(imageId, image) => {
            onChange({ imageId });
            onRegisterImage(imageId, image);
          }}
        />
        {block.imageId && (
          <CoverField
            label="Describe this photo for screen readers"
            value={block.alt ?? ""}
            multiline
            onChange={(alt) => onChange({ alt })}
          />
        )}
      </InspectorSection>
    </>
  );
}
