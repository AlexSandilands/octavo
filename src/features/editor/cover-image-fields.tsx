import type { Block, BlockPatch, PageAlign } from "@/lib/blocks";
import type { ResolvedImage } from "@/lib/images";
import { CoverField } from "./cover-fields";
import { ImageBlockControl } from "./image-upload";
import { ImageLayoutControls } from "./image-layout";

export function CoverImageFields({
  block,
  issueId,
  onChange,
  onFillPage,
  onRegisterImage,
}: {
  block: Extract<Block, { type: "image" }>;
  issueId: string;
  onChange: (patch: BlockPatch) => void;
  onFillPage: (align: PageAlign) => void;
  onRegisterImage: (id: string, image: ResolvedImage) => void;
}) {
  return (
    <div className="scrollbar-soft min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <ImageBlockControl
        issueId={issueId}
        hasImage={Boolean(block.imageId)}
        onUploaded={(imageId, image) => {
          onChange({ imageId });
          onRegisterImage(imageId, image);
        }}
      />
      {block.imageId && (
        <>
          <div className="[&_button]:h-9 [&_button]:min-w-9">
            <ImageLayoutControls
              cover
              stacked
              align={block.align ?? "full"}
              width={block.width ?? 100}
              onChange={onChange}
              onFillPage={onFillPage}
            />
          </div>
          <p className="text-muted font-sans text-xs leading-relaxed">
            Fill page crops the photo to the cover. Fit page shows the whole
            photo. Headings and cover elements remain above it.
          </p>
          <CoverField
            label="Describe this photo for screen readers"
            value={block.alt ?? ""}
            multiline
            onChange={(alt) => onChange({ alt })}
          />
        </>
      )}
    </div>
  );
}
