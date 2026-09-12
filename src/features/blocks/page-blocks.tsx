import type { CoverSource } from "@/lib/cover-elements";
import { CoverElementView } from "./cover-element-view";
import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockView } from "./block-view";
import type { LayoutTheme } from "./themes/registry";
import { blockFlowStyle, isFillPage } from "./layout";
import { PageContent } from "./page-content";

// The flowed block content of one page — shared by the desktop reader spread and
// the print/PDF renderer so a page lays out identically in both (no parallel
// renderer). Cover pages centre and stack every block; normal pages flow in
// document order so a floated image wraps the text that follows it.
export function PageBlocks({
  page,
  theme,
  images,
  sponsors,
  interactive = false,
  anchors = true,
  priority = false,
  sources,
  issueNo,
}: {
  page: Page;
  sources?: CoverSource[];
  issueNo?: number;
  theme: LayoutTheme;
  images: ImageMap;
  sponsors: SponsorMap;
  /** The reader sets this so blocks that animate (montage) come alive; the
   *  print/PDF document leaves it off and gets one deterministic frame. */
  interactive?: boolean;
  anchors?: boolean;
  priority?: boolean;
}) {
  return (
    <PageContent
      page={page}
      renderElement={(element) => (
        <div data-reader-block className="cursor-auto">
          <CoverElementView
            element={element}
            sources={sources}
            issueNo={issueNo}
            images={images}
          />
        </div>
      )}
      renderBlock={(b) => {
        // data-reader-block: the reader ignores drags started here (text/images
        // stay selectable) and reverts the grab cursor. Inert in print.
        // "bleed" is the exception — a photo covering the page has nothing to
        // select, so the reader treats it as the page it covers: it pans and
        // turns like a bare margin.
        const bleed = isFillPage(b);
        return (
          <div
            key={b.id}
            data-reader-block={bleed ? "bleed" : true}
            data-cover-sponsor={b.type === "sponsor" || undefined}
            className={bleed ? undefined : "cursor-auto"}
            style={blockFlowStyle(b, page.cover)}
          >
            <BlockView
              block={b}
              theme={theme}
              images={images}
              sponsors={sponsors}
              variant={page.cover ? "cover" : undefined}
              interactive={interactive}
              anchors={anchors}
              priority={priority}
            />
          </div>
        );
      }}
    />
  );
}
