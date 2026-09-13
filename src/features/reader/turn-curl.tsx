"use client";

import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";
import { coverSources } from "@/lib/cover-elements";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { PageView, Plate } from "./page-view";
import { STRIPS, sampleCurl } from "./curl-model";
import { animateCurl, FLIP_MS } from "./turn-curl-animate";
import type { Turn } from "./reader-spread";

const PERSPECTIVE = 2200;
/** Each face overhangs its neighbours by this much so clip edges never meet. */
const OVERLAP = 1;

type Props = {
  pages: Page[];
  spread: number;
  turn: Turn;
  theme: LayoutTheme;
  scale: number;
  issueNo: number;
  logo: ResolvedImage | null;
  settings: SiteSettings;
  images: ImageMap;
  sponsors: SponsorMap;
  onFinish: () => void;
  /** The reader's outer wrapper (desktop-reader.tsx) — a cover turn animates
   *  its recentre translateX on this same shared timeline. */
  recentreRef: RefObject<HTMLDivElement | null>;
};

// The shaded paper curl (issue #215): a hinge chain of STRIPS flat sections
// rotating about the spine, sampled once per turn (curl-model.ts) and animated
// through the Web Animations API (turn-curl-animate.ts) — no per-frame JS. This
// component is only the DOM: the still pages underneath, the sheet's strips
// with their shading, the cast shadows and the drop-shadow plate, all in the
// paint order the shading depends on.
export function TurnCurl({
  pages,
  spread,
  turn,
  theme,
  scale,
  issueNo,
  logo,
  settings,
  images,
  sponsors,
  onFinish,
  recentreRef,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const w = PAGE_W * scale;
  const h = PAGE_H * scale;
  const forward = turn.dir === "next";
  const front = forward ? 2 * spread : 2 * spread - 1;
  const back = forward ? 2 * turn.to - 1 : 2 * turn.to;
  const origin = forward ? "right" : "left";
  const dest = forward ? "left" : "right";
  const standingIdx = forward ? 2 * spread - 1 : 2 * spread;
  const coverOpen = spread === 0;
  const coverClose = turn.to === 0;

  // Kept out of the effect's deps (a fresh identity must not restart the
  // turn) — held in an effect event instead.
  const finish = useEffectEvent(() => onFinish());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const samples = sampleCurl(w, PERSPECTIVE);
    const animations = animateCurl(
      root,
      samples,
      w,
      forward,
      FLIP_MS,
      recentreRef.current,
      coverOpen,
      coverClose,
    );
    let cancelled = false;
    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        if (!cancelled) finish();
      })
      .catch(() => {
        // Cancelled below; the rejected `finished` promise is expected.
      });
    return () => {
      cancelled = true;
      animations.forEach((a) => a.cancel());
    };
  }, [turn, w, forward, recentreRef, coverOpen, coverClose]);

  // A page copy, absolutely positioned in the left or right half. `copy` marks
  // a duplicate of content shown elsewhere (the crack fix, or a strip face) —
  // those are static and hidden from assistive tech; the real standing/flat
  // pages stay interactive and visible to it.
  const sources = coverSources(pages);
  const layer = (
    index: number,
    side: "left" | "right",
    dataAttr?: string,
    copy = false,
  ) => (
    <div
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      aria-hidden={copy || undefined}
      className={copy ? "pointer-events-none" : undefined}
      style={{ position: "absolute", top: 0, left: side === "left" ? 0 : w }}
    >
      <PageView
        sources={sources}
        page={index >= 0 ? pages[index] : undefined}
        side={side}
        theme={theme}
        scale={scale}
        issueNo={issueNo}
        logo={logo}
        settings={settings}
        pageNo={index >= 0 ? index + 1 : undefined}
        images={images}
        sponsors={sponsors}
        interactive={!copy}
      />
    </div>
  );

  const cast = (side: "left" | "right", attr: string) => (
    <div
      {...{ [attr]: "" }}
      aria-hidden
      className="pointer-events-none absolute opacity-0"
      style={{
        top: 0,
        left: side === "left" ? 0 : w,
        width: w,
        height: h,
        transformOrigin: side === "left" ? "right" : "left",
        background: `linear-gradient(${side === "left" ? 270 : 90}deg, rgb(0 0 0 / 85%), rgb(0 0 0 / 30%) 35%, transparent)`,
      }}
    />
  );

  // Four overlays per face: {shade, sheen} × {hinge edge, far edge}, each a
  // gradient from its edge to transparent, so the pair interpolates the
  // lighting across the section (see turn-curl-animate.ts for the opacities).
  const shading = (i: number, rear: boolean) => {
    const hingeLeft = forward !== rear;
    return (["dark", "light"] as const).flatMap((tone) =>
      ([0, 1] as const).map((far) => (
        <div
          key={`${tone}${far}`}
          data-shade={`${i + far}:${rear ? "rear" : "front"}:${tone}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            background: `linear-gradient(to ${hingeLeft === !far ? "right" : "left"}, ${tone === "dark" ? "rgb(32 26 18)" : "rgb(255 252 246)"}, transparent)`,
          }}
        />
      )),
    );
  };

  const strip = (i: number): React.ReactNode => {
    const sw = w / STRIPS;
    const frontX = forward ? i * sw : w - (i + 1) * sw;
    const backX = w - frontX - sw;
    const hinge: CSSProperties = {
      position: "absolute",
      top: 0,
      left: i === 0 ? (forward ? w : w - sw) : forward ? sw : -sw,
      width: sw,
      height: h,
      transformStyle: "preserve-3d",
      transformOrigin: forward ? "left center" : "right center",
    };
    return (
      <div
        style={hinge}
        data-root={i === 0 ? "" : undefined}
        data-joint={i > 0 ? "" : undefined}
      >
        {([false, true] as const).map((rear) => {
          const x = rear ? backX : frontX;
          const padL = x > 0.01 ? OVERLAP : 0;
          const padR = x + sw < w - 0.01 ? OVERLAP : 0;
          return (
            <div
              key={String(rear)}
              aria-hidden
              className="bg-page pointer-events-none absolute overflow-hidden"
              style={{
                top: 0,
                bottom: 0,
                left: -padL,
                right: -padR,
                backfaceVisibility: "hidden",
                transformOrigin: `${sw / 2 + padL}px center`,
                transform: rear ? "rotateY(180deg)" : undefined,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -x + padL,
                  top: 0,
                  width: w,
                  height: h,
                }}
              >
                <PageView
                  sources={sources}
                  page={pages[rear ? back : front]}
                  side={rear === forward ? "left" : "right"}
                  theme={theme}
                  scale={scale}
                  issueNo={issueNo}
                  logo={logo}
                  settings={settings}
                  pageNo={(rear ? back : front) + 1}
                  images={images}
                  sponsors={sponsors}
                  interactive={false}
                />
              </div>
              {shading(i, rear)}
            </div>
          );
        })}
        {i + 1 < STRIPS && strip(i + 1)}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      data-turning
      style={{
        position: "relative",
        width: 2 * w,
        height: h,
        perspective: PERSPECTIVE,
      }}
    >
      {/* Destination spread, flat beneath everything. Opening the cover, only
          blank backing paper goes beneath (under the landed sheet); closing,
          the left is left empty. */}
      {coverOpen
        ? layer(-1, "left", "data-under-landed")
        : !coverClose && layer(2 * turn.to - 1, "left")}
      {layer(2 * turn.to, "right")}
      {/* The page still standing on the far side, clipped as the sheet lands. */}
      {!coverOpen && layer(standingIdx, dest, "data-under-dest")}
      {/* A copy of the lifting page, clipped to the sheet's footprint — the
          crack fix: a hairline between sections shows the sheet's own content. */}
      {layer(front, origin, "data-under-origin", true)}
      {cast(origin, "data-cast-origin")}
      {cast(dest, "data-cast-dest")}
      {/* Follows the cover's landed or lifting edge; full width otherwise. */}
      <Plate
        atCover={coverOpen}
        kind={coverOpen ? "open" : coverClose ? "close" : undefined}
      />
      {strip(0)}
    </div>
  );
}
