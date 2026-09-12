import { appearanceVars, resolveCoverAppearance } from "@/lib/cover-appearance";
import type { CSSProperties } from "react";
import { DEFAULT_COVER_OVERLAY, type Page } from "@/lib/blocks";
import { hasCoverLayout, type CoverSource } from "@/lib/cover-elements";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { BlockImage } from "@/features/blocks/block-view";
import { CoverElementView } from "@/features/blocks/cover-element-view";
import { CoverGrid } from "@/features/blocks/cover-grid";
import { coverEntries } from "@/features/blocks/cover-entries";
import { isFillPage } from "@/features/blocks/layout";
import { MobileBlock } from "./mobile-block";

export function MobileCover({
  page,
  images,
  sponsors,
  m,
  minHeight,
  sources,
  issueNo,
}: {
  page: Page;
  images: ImageMap;
  sponsors: SponsorMap;
  m: number;
  minHeight: string;
  sources?: CoverSource[];
  issueNo?: number;
}) {
  const background = page.blocks.find(isFillPage);
  const image =
    background?.type === "image" && background.imageId
      ? images[background.imageId]
      : undefined;
  const overlay =
    page.coverOverlay ??
    (background
      ? DEFAULT_COVER_OVERLAY
      : { style: "dark" as const, position: "center" as const });
  const paint = resolveCoverAppearance(
    overlay.style,
    page.coverOverlay?.appearance,
  );
  const foreground = page.blocks.filter((b) => b.id !== background?.id);
  const renderBlock = (b: Page["blocks"][number]) => (
    <div
      key={b.id}
      data-cover-sponsor={b.type === "sponsor" || undefined}
      style={{
        textAlign: "coverPlacement" in b ? b.coverPlacement?.align : undefined,
      }}
    >
      <MobileBlock block={b} images={images} sponsors={sponsors} m={m} cover />
    </div>
  );
  return (
    <section
      className="cover-composition bg-page relative text-center"
      data-cover-style={overlay.style}
      data-cover-position={overlay.position}
      data-cover-panel={paint.panel}
      style={
        {
          ...appearanceVars(paint),
          "--cover-mobile-text": `${m}px`,
        } as CSSProperties
      }
    >
      {background?.type === "image" && (
        <div className="absolute inset-0">
          {image ? (
            <BlockImage
              image={image}
              alt={background.alt || background.caption}
              priority
              fit={background.align === "page-fill" ? "cover" : "contain"}
            />
          ) : (
            <div
              className="photo-fill h-full"
              role="img"
              aria-label={background.alt || "Cover photo unavailable"}
            />
          )}
        </div>
      )}
      <div
        className="cover-overlay-layout relative flex flex-col px-5 py-8"
        style={{ minHeight }}
      >
        {hasCoverLayout(page) ? (
          <CoverGrid
            mobile
            style={overlay.style}
            entries={coverEntries(page, renderBlock, (element) => (
              <CoverElementView
                element={element}
                images={images}
                sources={sources}
                issueNo={issueNo}
              />
            ))}
          />
        ) : (
          foreground.length > 0 && (
            <div className="cover-overlay-content">
              {foreground.map(renderBlock)}
            </div>
          )
        )}
      </div>
    </section>
  );
}
