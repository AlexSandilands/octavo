"use client";

import type { CSSProperties } from "react";
import { textSizeScale, type Block } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { externalHref } from "@/lib/rich-text";
import { richTextToPlain } from "@/lib/rich-text-doc";
import { BlockImage } from "@/features/blocks/block-view";
import { isFillPage } from "@/features/blocks/layout";
import { RichText } from "@/features/blocks/rich-text";
import { resolveMontageSlides } from "@/features/blocks/montage";
import { MontagePlayer } from "@/features/blocks/montage-player";
import { VideoPlayer } from "@/features/blocks/video-player";

// One block as the mobile reader draws it. Split out of mobile-reader.tsx, which
// keeps the chrome (header, text-size control, contents drawer, the closing
// wordmark) — this file is the whole of the second dispatcher over the block
// union, the counterpart to BlockView on the fixed-canvas side.
//
// It is a separate renderer rather than a reuse of BlockView because the shapes
// genuinely differ: this reader reflows in one column at a reader-chosen base
// size (`m`), so every size here is relative to it, and it never floats a
// picture — phones are too narrow to wrap text around one for this audience. A
// picture in the body therefore fills the column whatever `width`/`align` the
// author chose for the printed page (#230); only a cover keeps the width it was
// given, centred the way `blockFlowStyle` centres a cover on the page.

// DOM id for a heading block, shared by the renderer and the contents drawer.
export function headingDomId(blockId: string): string {
  return `heading-${blockId}`;
}

// `align` is deliberately unread here: nothing wraps on a phone, so every
// placement collapses to the column (the full-bleed one is handled above, wider than it).
function pictureFigure(
  width: number | undefined,
  cover: boolean | undefined,
): { className: string; style?: CSSProperties } {
  const w = width ?? 100;
  return cover && w < 100
    ? { className: "my-3 mx-auto", style: { width: `${w}%` } }
    : { className: "my-3" };
}

export function MobileBlock({
  block,
  m,
  images,
  sponsors,
  cover,
}: {
  block: Block;
  m: number;
  images: ImageMap;
  sponsors: SponsorMap;
  cover?: boolean;
}) {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? "main";
      // Paragraph sub-heads: small, bold, no kicker — distinct from body.
      if (!cover && level === "paragraph") {
        return (
          <h3
            className="text-ink mt-4 mb-1.5 font-serif font-semibold leading-snug"
            style={{ fontSize: m + 2 }}
          >
            {block.title}
          </h3>
        );
      }
      // main/cover get the largest type; section sits between it and the body.
      const fontSize = cover ? m + 22 : level === "section" ? m + 7 : m + 13;
      return (
        <div className={cover ? "mb-4" : "mb-3 mt-1"}>
          {block.kicker && (
            <div
              className={`text-accent mb-2 font-sans font-semibold uppercase ${
                cover
                  ? "text-[12px] tracking-[0.3em]"
                  : "text-[11px] tracking-[0.2em]"
              }`}
            >
              {block.kicker}
            </div>
          )}
          <h2
            id={headingDomId(block.id)}
            tabIndex={-1}
            className="text-ink scroll-mt-4 font-serif leading-[1.1]"
            style={{ fontSize }}
          >
            {block.title}
          </h2>
        </div>
      );
    }
    case "text":
      return cover ? (
        <p
          className="text-muted mb-3 font-serif whitespace-pre-line italic"
          style={{ fontSize: m + 2, lineHeight: 1.6 }}
        >
          {richTextToPlain(block.text)}
        </p>
      ) : (
        <div
          className="text-body rich-text mb-4 font-serif"
          style={{ fontSize: m * textSizeScale(block.size), lineHeight: 1.62 }}
        >
          <RichText value={block.text} />
        </div>
      );
    case "image": {
      const resolved = block.imageId ? images[block.imageId] : undefined;
      // Runs the full phone width: -mx-5 cancels the section's px-5
      // (mobile-reader.tsx), and no vertical margin, since the section it owns
      // carries none either. No crop — there is no page shape here.
      if (resolved && isFillPage(block)) {
        return (
          <figure className="-mx-5">
            <BlockImage image={resolved} alt={block.alt || block.caption} />
          </figure>
        );
      }
      return (
        <figure {...pictureFigure(block.width, cover)}>
          {resolved ? (
            <BlockImage image={resolved} alt={block.alt || block.caption} />
          ) : (
            <div className="photo-fill border-placeholder-line flex h-[180px] items-center justify-center border">
              <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
                {block.caption || "PHOTO"}
              </span>
            </div>
          )}
          {block.caption && (
            <figcaption
              className="text-faint mt-2 font-sans"
              style={{ fontSize: Math.max(12, m - 5), lineHeight: 1.4 }}
            >
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "montage": {
      // Content v4. Placed exactly like the image block above, with the same
      // cross-fade widget the flipbook uses. Its timer only runs while the block
      // is scrolled into view — the whole issue is one mounted column here.
      const slides = resolveMontageSlides(block.items, images);
      return (
        <figure {...pictureFigure(block.width, cover)}>
          {slides.length > 0 ? (
            <MontagePlayer
              slides={slides}
              intervalSeconds={block.interval}
              label={block.caption}
            />
          ) : (
            <div className="photo-fill border-placeholder-line flex h-[180px] items-center justify-center border">
              <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
                {block.caption || "MONTAGE"}
              </span>
            </div>
          )}
          {block.caption && (
            <figcaption
              className="text-faint mt-2 font-sans"
              style={{ fontSize: Math.max(12, m - 5), lineHeight: 1.4 }}
            >
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "video": {
      // Content v5. Placed exactly like the image block above, with the same
      // facade the flipbook uses: the poster and a play button, and the YouTube
      // frame only once the member presses it — this is the reader where that
      // restraint matters most, since it is the phone one.
      const poster = block.posterImageId
        ? images[block.posterImageId]
        : undefined;
      return (
        <figure {...pictureFigure(block.width, cover)}>
          {block.videoId ? (
            <VideoPlayer
              videoId={block.videoId}
              poster={poster}
              label={block.caption}
            />
          ) : (
            <div className="photo-fill border-placeholder-line flex h-[180px] items-center justify-center border">
              <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
                {block.caption || "VIDEO"}
              </span>
            </div>
          )}
          {block.caption && (
            <figcaption
              className="text-faint mt-2 font-sans"
              style={{ fontSize: Math.max(12, m - 5), lineHeight: 1.4 }}
            >
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "sponsor": {
      // Same v1→v2 resolution as BlockView: a managed block resolves from the
      // sponsors map; a version-1 or manual block falls back to inline fields; a
      // managed reference that no longer resolves (deleted) is hidden.
      const managed = block.sponsorId ? sponsors[block.sponsorId] : undefined;
      if (block.sponsorId && !managed) return null;
      const name = managed ? managed.name : block.name;
      const logo = managed?.logo ?? null;
      const link = externalHref((managed ? managed.href : block.href) ?? "");
      const card = (
        <div className="bg-tint my-4 flex items-center gap-3 rounded-md p-4">
          <div className="bg-card text-faint flex h-12 w-24 flex-none items-center justify-center overflow-hidden rounded font-mono text-[10px]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.url}
                alt={name ? `${name} logo` : "Sponsor logo"}
                className="h-full w-full object-contain"
              />
            ) : (
              "SPONSOR"
            )}
          </div>
          <div>
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink font-sans text-base font-semibold">
              {name}
            </div>
            {link && (
              <div className="text-accent font-sans text-[13px] font-medium">
                Visit the store →
              </div>
            )}
          </div>
        </div>
      );
      return link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="block no-underline"
        >
          {card}
        </a>
      ) : (
        card
      );
    }
  }
}
