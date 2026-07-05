import { ImageResponse } from "next/og";
import { BRAND_ICON_COLORS, activeBrand } from "@/lib/brands";

// Shared renderer for the App Router icon routes (src/app/icon.tsx +
// apple-icon.tsx). Draws Octavo's mark — an open book (an octavo is a book
// format), two paper pages opened nearly flat on the brand accent — as a PNG,
// so the mark is a raster every browser and phone home screen can show (an SVG
// favicon still isn't reliable on older iOS Safari, and this audience is
// phone-heavy). It's brand-aware: the two colours come from BRAND_ICON_COLORS
// keyed off the build-time NEXT_PUBLIC_BRAND, so each deployment's tab icon
// matches its skin. The pages are two chunky parallelograms with a spine gap —
// no strokes or detail lines, so the silhouette survives the browser shrinking
// it to a 16px tab glyph.
export function renderSiteIcon(px: number): ImageResponse {
  const { bg, fg } = BRAND_ICON_COLORS[activeBrand()];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        borderRadius: px * 0.18,
      }}
    >
      <svg width={px * 0.82} height={px * 0.82} viewBox="0 0 32 32" fill="none">
        {/* Left page: outer edge lifted ~3 units above the spine edge, so the
            book reads as almost-but-not-quite flat open. */}
        <path d="M2.5 8 L15 11 L15 25.5 L2.5 22.5 Z" fill={fg} />
        {/* Right page, mirrored; the 2-unit accent gap between them is the
            spine crease. */}
        <path d="M29.5 8 L17 11 L17 25.5 L29.5 22.5 Z" fill={fg} />
      </svg>
    </div>,
    { width: px, height: px },
  );
}
