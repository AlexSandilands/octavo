"use client";

import type { Block } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockView } from "@/features/blocks/block-view";
import { blockFlowStyle } from "@/features/blocks/layout";
import type { LayoutTheme } from "@/features/blocks/themes/registry";

// The block a dragged region will become, set into the page at the index it
// would take, as the reader would set it. Not a block yet: it lives outside
// the document and its history until the drop runs the ordinary import.
export function DropPreview({
  block,
  theme,
  images,
  sponsors,
}: {
  block: Block;
  theme: LayoutTheme;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  return (
    <div
      data-drop-preview
      className="outline-accent/60 relative rounded-[3px] outline-2 outline-offset-4 outline-dashed starting:opacity-0 motion-safe:transition-opacity motion-safe:duration-200"
      style={blockFlowStyle(block)}
    >
      <BlockView
        block={block}
        theme={theme}
        images={images}
        sponsors={sponsors}
        edit={block.type === "text" ? undefined : { onChange: () => {} }}
      />
    </div>
  );
}
