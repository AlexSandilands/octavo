import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockView } from "./block-view";
import type { LayoutTheme } from "./themes/registry";
import { blockFlowStyle } from "./layout";

// The flowed block content of one page — shared by the desktop reader spread and
// the print/PDF renderer so a page lays out identically in both (no parallel
// renderer). Cover pages centre and stack every block; normal pages flow in
// document order so a floated image wraps the text that follows it.
export function PageBlocks({
  page,
  theme,
  images,
  sponsors,
}: {
  page: Page;
  theme: LayoutTheme;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  return (
    <div
      className={
        page.cover
          ? "flex min-h-full flex-col justify-center"
          : "relative flow-root"
      }
    >
      {page.blocks.map((b) => (
        // data-reader-block: the reader ignores drags started here (text/images
        // stay selectable) and reverts the grab cursor. Inert in print.
        <div
          key={b.id}
          data-reader-block
          className="cursor-auto"
          style={blockFlowStyle(b, page.cover)}
        >
          <BlockView
            block={b}
            theme={theme}
            images={images}
            sponsors={sponsors}
            variant={page.cover ? "cover" : undefined}
          />
        </div>
      ))}
    </div>
  );
}
