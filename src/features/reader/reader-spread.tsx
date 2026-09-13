"use client";

import type { RefObject } from "react";
import { coverSources } from "@/lib/cover-elements";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { PageView, Plate } from "./page-view";
import { TurnCurl } from "./turn-curl";

export { FLIP_MS } from "./turn-curl-animate";

export type Turn = { dir: "next" | "prev"; to: number };

// The spine-centred spread shown inside the reader's stage: either an in-flight
// page turn (the shaded curl, issue #215), the standalone cover, or a normal
// two-page spread. The outer transform/pan wrapper and the edge-zone flip live
// in the reader; this owns the page rendering and the turn animation only.
export function ReaderSpread({
  pages,
  spread,
  turn,
  onTurnEnd,
  theme,
  scale,
  issueNo,
  logo,
  settings,
  images,
  sponsors,
  recentreRef,
}: {
  pages: Page[];
  spread: number;
  turn: Turn | null;
  /** Called once the curl's animations finish (or fail to, see the reader's
   *  safety-net timer) — commits `spread` to `turn.to` and clears `turn`. */
  onTurnEnd: () => void;
  theme: LayoutTheme;
  scale: number;
  issueNo: number;
  logo: ResolvedImage | null;
  /** The magazine's effective branding + footer appearance (issue #105). */
  settings: SiteSettings;
  images: ImageMap;
  sponsors: SponsorMap;
  /** The reader's outer wrapper — a cover turn recentres it on the curl's
   *  shared timeline (see turn-curl-animate.ts). */
  recentreRef: RefObject<HTMLDivElement | null>;
}) {
  if (turn) {
    return (
      <TurnCurl
        pages={pages}
        spread={spread}
        turn={turn}
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        logo={logo}
        settings={settings}
        images={images}
        sponsors={sponsors}
        onFinish={onTurnEnd}
        recentreRef={recentreRef}
      />
    );
  }

  // Like a real magazine, the cover (page 1) stands alone, then the rest pair up
  // into spreads: view 0 = [cover], view k≥1 = pages 2k & 2k+1.
  const isCover = spread === 0;
  const leftIdx = isCover ? 0 : 2 * spread - 1;
  const left = pages[leftIdx];
  const right = isCover ? undefined : pages[leftIdx + 1];
  const leftNo = leftIdx + 1;

  const sources = coverSources(pages);
  if (isCover) {
    // The cover reads as a single, centred page. It still renders as the right
    // leaf of the spine-centred spread — the reader keeps the box a constant
    // 2·PAGE_W and translates it so the cover sits centred, so the first turn
    // reuses the same curl geometry with no width jump. The facing leaf holds
    // its layout slot (constant width) but is hidden, so only the cover shows.
    return (
      <>
        <Plate atCover />
        <div className="flex-none [visibility:hidden]">
          <PageView
            sources={sources}
            side="left"
            theme={theme}
            scale={scale}
            issueNo={issueNo}
            logo={logo}
            settings={settings}
            images={images}
            sponsors={sponsors}
          />
        </div>
        <PageView
          sources={sources}
          page={left}
          side="right"
          theme={theme}
          scale={scale}
          issueNo={issueNo}
          logo={logo}
          settings={settings}
          pageNo={1}
          images={images}
          sponsors={sponsors}
        />
      </>
    );
  }

  return (
    <>
      <Plate atCover={false} />
      <PageView
        sources={sources}
        page={left}
        side="left"
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        logo={logo}
        settings={settings}
        pageNo={leftNo}
        images={images}
        sponsors={sponsors}
      />
      <PageView
        sources={sources}
        page={right}
        side="right"
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        logo={logo}
        settings={settings}
        pageNo={leftNo + 1}
        images={images}
        sponsors={sponsors}
      />
    </>
  );
}
