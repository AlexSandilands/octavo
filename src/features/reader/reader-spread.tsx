"use client";

import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { type Theme } from "@/features/blocks/block-view";
import { PageBlocks } from "@/features/blocks/page-blocks";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";

// Duration of the page-curl, shared with the reader's turn commit timer.
export const FLIP_MS = 700;

export type Turn = { dir: "next" | "prev"; to: number };

// The spine-centred spread shown inside the reader's stage: either an in-flight
// page turn, the standalone cover, or a normal two-page spread. The outer
// transform/pan wrapper and the edge-zone flip live in the reader; this owns the
// page rendering and the turn animation only.
export function ReaderSpread({
  pages,
  spread,
  turn,
  turnAngle,
  theme,
  scale,
  issueNo,
  images,
  sponsors,
}: {
  pages: Page[];
  spread: number;
  turn: Turn | null;
  turnAngle: number;
  theme: Theme;
  scale: number;
  issueNo: number;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  if (turn) {
    return (
      <TurnLeaf
        pages={pages}
        spread={spread}
        turn={turn}
        turnAngle={turnAngle}
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        images={images}
        sponsors={sponsors}
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

  if (isCover) {
    // The cover is a single page, but it's shown as the right leaf of a
    // spine-centred spread (blank facing page) so it opens with the same
    // page-curl as every other spread — no width jump.
    return (
      <>
        <PageView
          side="left"
          theme={theme}
          scale={scale}
          issueNo={issueNo}
          images={images}
          sponsors={sponsors}
        />
        <PageView
          page={left}
          side="right"
          theme={theme}
          scale={scale}
          issueNo={issueNo}
          pageNo={1}
          images={images}
          sponsors={sponsors}
        />
      </>
    );
  }

  return (
    <>
      <PageView
        page={left}
        side="left"
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        pageNo={leftNo}
        images={images}
        sponsors={sponsors}
      />
      <PageView
        page={right}
        side="right"
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        pageNo={leftNo + 1}
        images={images}
        sponsors={sponsors}
      />
    </>
  );
}

// The animated spread: the destination spread painted beneath, the current
// non-moving page on top, and a single leaf rotating around the spine from the
// moving half (front = the current page, back = the destination page it lands
// on, so the turn resolves seamlessly into the committed spread).
function TurnLeaf({
  pages,
  spread: s,
  turn,
  turnAngle,
  theme,
  scale,
  issueNo,
  images,
  sponsors,
}: {
  pages: Page[];
  spread: number;
  turn: Turn;
  turnAngle: number;
  theme: Theme;
  scale: number;
  issueNo: number;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  const pageW = PAGE_W * scale;
  const pageH = PAGE_H * scale;
  const fwd = turn.dir === "next";
  const clIdx = 2 * s - 1; // current left
  const crIdx = 2 * s; // current right
  const baseLeftIdx = fwd ? 2 * s + 1 : 2 * s - 3;
  const baseRightIdx = fwd ? 2 * s + 2 : 2 * s - 2;

  const layer = (idx: number, side: "left" | "right", x: number) => (
    <div style={{ position: "absolute", top: 0, left: x }}>
      <PageView
        page={pages[idx]}
        side={side}
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        pageNo={idx + 1}
        images={images}
        sponsors={sponsors}
      />
    </div>
  );

  const frontIdx = fwd ? crIdx : clIdx;
  const backIdx = fwd ? baseLeftIdx : baseRightIdx;
  const backSide = fwd ? "left" : "right";

  return (
    <div
      style={{
        position: "relative",
        width: 2 * pageW,
        height: pageH,
        perspective: 2200,
      }}
    >
      {layer(baseLeftIdx, "left", 0)}
      {layer(baseRightIdx, "right", pageW)}
      {fwd ? layer(clIdx, "left", 0) : layer(crIdx, "right", pageW)}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: fwd ? pageW : 0,
          width: pageW,
          height: pageH,
          zIndex: 5,
          transformStyle: "preserve-3d",
          transformOrigin: fwd ? "left center" : "right center",
          transform: `rotateY(${turnAngle}deg)`,
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.3, 0.1, 0.2, 1)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          }}
        >
          <PageView
            page={pages[frontIdx]}
            side={fwd ? "right" : "left"}
            theme={theme}
            scale={scale}
            issueNo={issueNo}
            pageNo={frontIdx + 1}
            images={images}
            sponsors={sponsors}
          />
        </div>
        <div
          className="bg-page"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <PageView
            page={pages[backIdx]}
            side={backSide}
            theme={theme}
            scale={scale}
            issueNo={issueNo}
            pageNo={backIdx + 1}
            images={images}
            sponsors={sponsors}
          />
        </div>
      </div>
    </div>
  );
}

function PageView({
  page,
  side,
  theme,
  scale,
  issueNo,
  pageNo,
  images,
  sponsors,
}: {
  page?: Page;
  side: "left" | "right";
  theme: Theme;
  scale: number;
  issueNo: number;
  pageNo?: number;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  return (
    <ScaledPage scale={scale}>
      <PageFrame
        theme={theme}
        w={PAGE_W}
        h={PAGE_H}
        issueNo={issueNo}
        pageNo={page ? pageNo : undefined}
        side={side}
      >
        {page && (
          <PageBlocks
            page={page}
            theme={theme}
            images={images}
            sponsors={sponsors}
          />
        )}
      </PageFrame>
    </ScaledPage>
  );
}
