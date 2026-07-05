import { ImageResponse } from "next/og";
import { BRAND_ICON_COLORS, activeBrand } from "@/lib/brands";

// Shared renderer for the App Router icon routes (src/app/icon.tsx +
// apple-icon.tsx). Draws Octavo's "O" monogram — a paper letter on the brand
// accent — as a PNG, so the mark is a raster every browser and phone home
// screen can show (an SVG favicon still isn't reliable on older iOS Safari, and
// this audience is phone-heavy). It's brand-aware: the two colours come from
// BRAND_ICON_COLORS keyed off the build-time NEXT_PUBLIC_BRAND, so each
// deployment's tab icon matches its skin. Runs server-side at the default
// (Node) runtime — no font is provided, so ImageResponse renders the single
// Latin letter with its built-in default face, which is more than legible at
// 16–32px.
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
        color: fg,
        fontWeight: 700,
        // Fill the square so the "O" holds up when the browser shrinks it to
        // a 16px tab glyph.
        fontSize: px * 0.72,
        lineHeight: 1,
        borderRadius: px * 0.18,
      }}
    >
      O
    </div>,
    { width: px, height: px },
  );
}
