"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MenuSelect, useSlideIntoView } from "@/components/menu-select";
import { colorCss, type CoverColor } from "@/lib/cover-appearance";
import { COVER_FONTS, COVER_FONT_IDS, type CoverFont } from "@/lib/cover-fonts";
import { ColorSwatches, resolvedColor } from "./cover-color-picker";
import { CAP_NUDGE } from "./cap-nudge";

const SHORT_FONT_NAMES: Record<CoverFont, string> = {
  newsreader: "Newsreader",
  "hanken-grotesk": "Hanken",
  "roboto-condensed": "Roboto Cond.",
};

// The font menu and colour button a block bar offers for words on an interior
// page (content v11): the selected words in body text, or a heading's title.
// "Theme default" clears either choice. A colour that reads poorly on the page
// is flagged, not refused.
export function TextPaintControls({
  label,
  color,
  font,
  onColor,
  onFont,
  onBeforeOpen,
}: {
  /** What's styled, for accessible names: "Selected text", "Heading". */
  label: string;
  color?: CoverColor;
  font?: CoverFont;
  onColor: (color: CoverColor | null) => void;
  onFont: (font: CoverFont | null) => void;
  /** Snapshot a text selection before the font menu moves focus (the colour
   *  tray keeps it: its buttons never take focus from the words). */
  onBeforeOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  useSlideIntoView(tray, open);
  const contrast = useContrastWithPage(color);
  const low = contrast !== null && contrast < 4.5;

  // The tray closes on an outside press or Escape, like the house menus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // Presses in the portalled font menu reach the canvas through React, which
    // would start a pan and deselect the block; stop them here.
    <div
      ref={root}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative flex items-center gap-1.5"
    >
      <MenuSelect<CoverFont | undefined>
        portal
        returnFocusOnSelect={false}
        size="bar"
        label=""
        ariaLabel={`${label} font`}
        triggerLabel={`${label} font`}
        current={font ? SHORT_FONT_NAMES[font] : "Theme font"}
        value={font}
        onBeforeOpen={onBeforeOpen}
        className="w-28"
        items={[
          { key: "theme", value: undefined, content: "Theme default" },
          ...COVER_FONT_IDS.map((value) => ({
            key: value,
            value,
            content: (
              <span style={{ fontFamily: COVER_FONTS[value].css }}>
                {COVER_FONTS[value].label}
              </span>
            ),
          })),
        ]}
        onSelect={(next) => onFont(next ?? null)}
      />
      <button
        type="button"
        title={`${label} colour`}
        aria-label={`${label} colour`}
        aria-expanded={open}
        aria-haspopup="true"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`border-hair flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border px-1.5 transition-colors ${
          open ? "bg-accent" : "hover:bg-accent-wash bg-white"
        }`}
      >
        {/* The current colour as a swatch; a paper ring keeps it legible on
            the pressed (accent) button. No colour → the theme's ink. */}
        <span
          aria-hidden
          className="border-hair-warm block h-4 w-4 rounded-full border shadow-[0_0_0_1.5px_var(--color-page)]"
          style={{ background: color ? colorCss(color) : "var(--color-ink)" }}
        />
        {low && (
          <span
            aria-hidden
            className={`${CAP_NUDGE.sans} text-warn font-sans text-[12px] font-bold`}
          >
            !
          </span>
        )}
      </button>
      {open && (
        <div
          ref={tray}
          role="group"
          aria-label={`${label} colour`}
          className="border-hair absolute top-full left-0 z-30 mt-2 w-max space-y-2 rounded-[8px] border bg-white p-2 shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={!color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onColor(null);
              }}
              className={`h-7 rounded-[6px] border px-2 font-sans text-[12px] font-semibold ${
                color
                  ? "border-hair text-muted hover:bg-accent-wash hover:text-accent bg-white"
                  : "bg-accent text-paper border-transparent"
              }`}
            >
              <span className={CAP_NUDGE.sans}>Theme default</span>
            </button>
            <ColorSwatches
              label={`${label} colour`}
              value={color}
              size={24}
              onChange={(c) => onColor(c)}
            />
          </div>
          {low && (
            <p
              role="status"
              className="text-warn w-0 min-w-full font-sans whitespace-normal text-[12px] leading-snug font-medium"
            >
              This colour is hard to read on the page ({contrast!.toFixed(1)}:1;
              aim for 4.5:1 or more).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** WCAG contrast of a colour against the page, measured from the live tokens
 *  (brands differ). Null with no colour chosen. */
function useContrastWithPage(color?: CoverColor): number | null {
  // Only rendered in the browser (a selected block's bar), so the DOM is there.
  return useMemo(
    () =>
      color
        ? contrastRatio(
            resolvedColor(colorCss(color)),
            resolvedColor("var(--color-page)"),
          )
        : null,
    [color],
  );
}

export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
