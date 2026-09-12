import type { Block } from "@/lib/blocks";
import { BlockView } from "@/features/blocks/block-view";
import { blockFlowStyle } from "@/features/blocks/layout";
import type { MeasurementOptions } from "./measure";

/** Editor presentation includes editable empty kickers/captions as real space. */
export function MeasurementBlocks({
  blocks,
  options,
}: {
  blocks: Block[];
  options: MeasurementOptions;
}) {
  return (
    <div className="relative flow-root">
      {blocks.map((block) => (
        <div
          key={block.id}
          data-reader-block
          className="relative"
          style={blockFlowStyle(block)}
        >
          <BlockView
            block={block}
            theme={options.theme}
            images={options.images}
            sponsors={options.sponsors}
            edit={block.type === "text" ? undefined : { onChange: () => {} }}
          />
        </div>
      ))}
    </div>
  );
}
