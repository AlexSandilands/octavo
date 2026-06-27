import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import { BlockView, type Theme } from "@/features/blocks/block-view";
import { blockFlowStyle } from "@/features/blocks/layout";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";

// A real, to-scale render of an issue's cover page, used as the library
// thumbnail. Reuses the exact reader pipeline (PageFrame + BlockView + the cover
// variant) at a small fixed scale, so it always matches what the editor shows —
// no screenshots or separate render path. Read-only and inert (no `edit`), so it
// renders server-side with no client JS.
export function CoverThumb({
  page,
  theme,
  images,
  issueNo,
  width,
}: {
  page: Page;
  theme: string;
  images: ImageMap;
  issueNo: number;
  width: number;
}) {
  const themeName: Theme = theme === "modern" ? "Modern" : "Classic";
  return (
    <div className="pointer-events-none select-none">
      <ScaledPage scale={width / PAGE_W}>
        <PageFrame
          theme={themeName}
          w={PAGE_W}
          h={PAGE_H}
          issueNo={issueNo}
          side="right"
        >
          <div
            className={
              page.cover
                ? "flex min-h-full flex-col justify-center"
                : "relative flow-root"
            }
          >
            {page.blocks.map((b) => (
              <div key={b.id} style={blockFlowStyle(b, page.cover)}>
                <BlockView
                  block={b}
                  theme={themeName}
                  images={images}
                  variant={page.cover ? "cover" : undefined}
                />
              </div>
            ))}
          </div>
        </PageFrame>
      </ScaledPage>
    </div>
  );
}
