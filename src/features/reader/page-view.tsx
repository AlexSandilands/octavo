import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { PageBlocks } from "@/features/blocks/page-blocks";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";

// Drop-shadow plate behind the pages, sized to the visible sheet: the full
// spread, or just the cover leaf when centred. A box shadow on the spread
// wrapper would flatten the flip's 3D, so it lives on its own element. `kind`
// marks a cover turn's plate for turn-curl-animate.ts to slide with the sheet.
export function Plate({
  atCover,
  kind,
}: {
  atCover: boolean;
  kind?: "open" | "close";
}) {
  return (
    <div
      data-plate={kind}
      aria-hidden
      className="pointer-events-none absolute top-0 shadow-[0_18px_40px_rgba(40,36,28,0.18)]"
      style={{
        left: atCover ? "50%" : "0%",
        width: atCover ? "50%" : "100%",
        height: "100%",
      }}
    />
  );
}

// One page, scaled and framed — shared by the resting spread (reader-spread.tsx)
// and every page copy the curl paints while turning (turn-curl.tsx).
export function PageView({
  page,
  side,
  theme,
  scale,
  issueNo,
  logo,
  settings,
  pageNo,
  images,
  sponsors,
  interactive = true,
}: {
  page?: Page;
  side: "left" | "right";
  theme: LayoutTheme;
  scale: number;
  issueNo: number;
  logo: ResolvedImage | null;
  settings: SiteSettings;
  pageNo?: number;
  images: ImageMap;
  sponsors: SponsorMap;
  /** Off for the curl's page copies (static frames the turn briefly shows) so a
   *  montage doesn't animate thirteen times over; the resting spread leaves it
   *  on (default) so the visible pages stay live. */
  interactive?: boolean;
}) {
  return (
    <ScaledPage scale={scale}>
      <PageFrame
        theme={theme}
        w={PAGE_W}
        h={PAGE_H}
        issueNo={issueNo}
        logo={logo}
        settings={settings}
        pageNo={page ? pageNo : undefined}
        side={side}
        cover={page?.cover}
        bleed={pageFillsCanvas(page)}
      >
        {page && (
          <PageBlocks
            page={page}
            theme={theme}
            images={images}
            sponsors={sponsors}
            interactive={interactive}
          />
        )}
      </PageFrame>
    </ScaledPage>
  );
}
