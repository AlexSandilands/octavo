import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockView } from "@/features/blocks/block-view";
import { resolveTheme } from "@/features/blocks/themes/registry";
import { blockFlowStyle, pageFillsCanvas } from "@/features/blocks/layout";
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
// renders server-side with no client JS — and `anchors={false}`, because both
// library surfaces wrap this whole render in a card-sized <Link href="/read/…">
// and a page carrying a sponsor link or a video address would otherwise nest an
// <a> inside that one (issue #166).
export function CoverThumb({
  page,
  theme,
  images,
  sponsors,
  issueNo,
  settings,
  width,
  priority = false,
}: {
  page: Page;
  theme: string;
  images: ImageMap;
  /** Required, like `images`: a cover's sponsor blocks store only a `sponsorId`
   *  (content v2), and BlockView renders a managed reference it cannot resolve
   *  as nothing at all. Without the map the block would silently vanish from an
   *  otherwise to-scale render (issue #170), so every caller must resolve it. */
  sponsors: SponsorMap;
  issueNo: number;
  /** The magazine's effective branding + footer appearance (issue #105) — the
   *  thumbnail is a real page render, chrome and all. */
  settings: SiteSettings;
  width: number;
  /** Eager-load the cover image — set only for the hero (LCP), not the archive. */
  priority?: boolean;
}) {
  // Free-text stored value → a renderable theme, degrading anything unknown to
  // the default so a legacy/misconfigured issue still shows a thumbnail.
  const resolved = resolveTheme(theme);
  return (
    <div className="pointer-events-none select-none">
      <ScaledPage scale={width / PAGE_W}>
        <PageFrame
          theme={resolved}
          w={PAGE_W}
          h={PAGE_H}
          issueNo={issueNo}
          side="right"
          settings={settings}
          bleed={pageFillsCanvas(page)}
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
                  theme={resolved}
                  images={images}
                  sponsors={sponsors}
                  variant={page.cover ? "cover" : undefined}
                  priority={priority}
                  anchors={false}
                />
              </div>
            ))}
          </div>
        </PageFrame>
      </ScaledPage>
    </div>
  );
}
