import type { CoverSource } from "@/lib/cover-elements";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { PageBlocks } from "./page-blocks";
import { resolveTheme, type LayoutTheme } from "./themes/registry";
import { pageFillsCanvas } from "./layout";
import { PageFrame, ScaledPage, PAGE_W, PAGE_H } from "./page-frame";

// A real, to-scale render of one page: the reader pipeline (PageFrame +
// PageBlocks) at a small fixed scale, so it always matches what the editor shows.
// Inert and decorative — `anchors={false}` because every caller wraps it in its
// own link or button, and a sponsor/video link would otherwise nest an <a> in it
// (issue #166). No hooks, so it renders server-side for the library too.
export function PageThumb({
  page,
  theme,
  images,
  sponsors,
  issueNo,
  pageNo,
  side = "right",
  settings,
  logo = null,
  width,
  priority = false,
  marked,
  sources,
}: {
  page: Page;
  sources?: CoverSource[];
  /** A stored theme id (degraded to the default if unknown) or a resolved theme. */
  theme: string | LayoutTheme;
  images: ImageMap;
  /** Required: a sponsor block stores only a `sponsorId`, and an unresolved
   *  one renders as nothing (issue #170). */
  sponsors: SponsorMap;
  issueNo: number;
  /** The folio in an interior page's running footer; covers carry no footer. */
  pageNo?: number;
  /** Which leaf the theme decorates; the editor canvas draws every page as "left". */
  side?: "left" | "right";
  settings: SiteSettings;
  logo?: ResolvedImage | null;
  width: number;
  /** Eager-load the page's images — only for an above-the-fold (LCP) thumb. */
  priority?: boolean;
  /** See PageFrame: the editor rail turns the frame marker off. */
  marked?: boolean;
}) {
  const resolved = typeof theme === "string" ? resolveTheme(theme) : theme;
  return (
    <div className="pointer-events-none select-none">
      <ScaledPage scale={width / PAGE_W}>
        <PageFrame
          theme={resolved}
          w={PAGE_W}
          h={PAGE_H}
          issueNo={issueNo}
          pageNo={pageNo}
          side={side}
          logo={logo}
          settings={settings}
          cover={page.cover}
          coverDecoration={page.coverOverlay?.decoration}
          coverMasthead={page.coverOverlay?.masthead}
          bleed={pageFillsCanvas(page)}
          marked={marked}
        >
          <PageBlocks
            page={page}
            sources={sources}
            issueNo={issueNo}
            theme={resolved}
            images={images}
            sponsors={sponsors}
            priority={priority}
            anchors={false}
          />
        </PageFrame>
      </ScaledPage>
    </div>
  );
}
