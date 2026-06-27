import { site } from "@/lib/site";
import type { Theme } from "./block-view";

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
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
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
  clip = true,
  boundary = false,
  children,
}: {
  theme: Theme;
  w: number;
  h: number;
  issueNo: number;
  pageNo?: number;
  side?: "left" | "right";
  /** Reader clips overflow to the page box; the editor leaves it visible. */
  clip?: boolean;
  /** Mark where the reader will clip (editor only). */
  boundary?: boolean;
  children: React.ReactNode;
}) {
  const isClassic = theme === "Classic";
  return (
    <div
      style={{ width: w, height: h }}
      className={`bg-page relative px-10 pt-10 ${
        clip ? "overflow-hidden" : "overflow-visible"
      } ${side === "left" ? "border-r border-[#efe7d8]" : ""}`}
    >
      {isClassic ? (
        <>
          <div className="pointer-events-none absolute inset-3.5 border border-[#dcd1b6]" />
          <div className="pointer-events-none absolute inset-[17px] border border-[#e8e0cb]" />
          <div className="text-faint2 pointer-events-none absolute top-5 right-3.5 left-3.5 text-center font-sans text-[8px] tracking-[0.32em] uppercase">
            {site.name} · No. {issueNo}
          </div>
        </>
      ) : (
        <div
          className={`bg-accent pointer-events-none absolute top-0 bottom-0 w-[5px] ${
            side === "left" ? "left-0" : "right-0"
          }`}
        />
      )}

      {children}

      <div className="text-faint2 absolute right-10 bottom-4 left-10 flex justify-between font-sans text-[10px] font-medium tracking-[0.12em] uppercase">
        <span>{side === "left" ? site.name : `No. ${issueNo}`}</span>
        <span>{pageNo ?? ""}</span>
      </div>

      {boundary && (
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{ top: h }}
        >
          <div className="border-warn border-t border-dashed" />
          <div className="flex justify-center">
            <span className="bg-warn text-paper rounded-b px-2 py-0.5 font-sans text-[9px] font-semibold tracking-[0.1em] uppercase">
              Reader clips below
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
