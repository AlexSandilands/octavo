import type { SiteSettings } from "@/lib/branding";
import type { ResolvedImage } from "@/lib/images";
import type { LayoutTheme } from "./themes/registry";
import { PageFooter } from "./page-footer";

// The fixed design canvas every page is authored and rendered at. The reader and
// editor never change these px — they render the page at this size and scale the
// whole thing as a unit (see ScaledPage), so type, images and spacing always
// keep their proportions. Sized generously (≈A4 proportions) so a real page of
// content — heading, several paragraphs, an image — fits comfortably and body
// type can be set small without overflowing. Type/spacing are authored in
// absolute px against these dimensions, so enlarging the canvas makes the same
// content occupy a smaller, more page-like fraction.
export const PAGE_W = 640;
export const PAGE_H = 900;

// Renders a fixed PAGE_W×PAGE_H page scaled to `scale`, reserving the scaled box
// in layout so neighbours flow correctly. transform-origin top-left keeps the
// scaled page pinned to the reserved box's corner.
export function ScaledPage({
  scale,
  children,
}: {
  scale: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      className="flex-none"
    >
      <div
        style={
          {
            width: PAGE_W,
            height: PAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            // Lets editor chrome cancel the scale (see `.chrome-unscaled`).
            "--page-scale": scale,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}

// The chrome of a single magazine page: dimensions, themed decorations
// (classic double border + masthead, or modern accent bar) and the running
// footer. Shared by the reader spread and the admin editor so a page looks
// identical in both — only the contents (`children`) and a couple of editor
// affordances differ.
export function PageFrame({
  theme,
  w,
  h,
  issueNo,
  pageNo,
  side = "left",
  logo = null,
  settings,
  clip = true,
  children,
}: {
  theme: LayoutTheme;
  w: number;
  h: number;
  issueNo: number;
  pageNo?: number;
  side?: "left" | "right";
  /** The issue's footer mark (`issues.logoId`, resolved). Null → text footer. */
  logo?: ResolvedImage | null;
  /** The magazine's effective branding + footer appearance (issue #105),
   *  resolved on the server and threaded in so a page renders the same in the
   *  reader, the editor, a thumbnail and the PDF. */
  settings: SiteSettings;
  /** Reader clips overflow to the page box; the editor leaves it visible. */
  clip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ width: w, height: h }}
      // The editor measures overflow against this box and the footer below it
      // (see features/editor/page-metrics.ts), so the page's real padding and
      // footer position stay the single source of truth for where a page ends.
      data-page-frame
      className={`bg-page relative px-10 pt-10 ${
        clip ? "overflow-hidden" : "overflow-visible"
      } ${side === "left" ? "border-page-seam border-r" : ""}`}
    >
      {theme.page.decoration({ issueNo, side, magazineName: settings.name })}

      {children}

      <PageFooter
        logo={logo}
        issueNo={issueNo}
        pageNo={pageNo}
        side={side}
        logoBottom={theme.page.logoFooterBottom}
        settings={settings}
      />
    </div>
  );
}
