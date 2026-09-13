import { cloneElement, isValidElement, type HTMLAttributes } from "react";
import { resolveTheme } from "./themes/registry";
import type { MontageSlide } from "./montage";

export type MontageCaptionProps = {
  slides: MontageSlide[];
  /** A legacy shared caption takes precedence until the author converts it. */
  caption?: string;
  themeId?: string;
  mobileFontSize?: number;
};

// All captions share one grid cell: even a blank slide reserves the tallest
// caption's space, identically in the editor, readers, thumbnails and PDF.
export function MontageCaption({
  slides,
  caption,
  themeId,
  mobileFontSize,
  index = 0,
  live,
}: MontageCaptionProps & { index?: number; live?: "off" | "polite" }) {
  const shared = caption?.trim() ? caption : undefined;
  const captions = shared
    ? [shared]
    : slides.map((slide) => slide.caption ?? "");
  if (!captions.some((text) => text.trim())) return null;
  const active = shared ? 0 : index;
  const visible = !!captions[active]?.trim();
  const content = (
    <span className="grid min-w-0 [overflow-wrap:anywhere]">
      {captions.map((text, i) => (
        <span
          key={i}
          data-montage-caption-active={
            i === active && visible ? "true" : "false"
          }
          aria-hidden={i !== active || !visible}
          className={`col-start-1 row-start-1 ${i === active ? "" : "invisible"}`}
        >
          {text}
        </span>
      ))}
    </span>
  );
  const frame = mobileFontSize ? (
    <figcaption
      className="text-faint mt-2 font-sans"
      style={{ fontSize: mobileFontSize, lineHeight: 1.4 }}
    >
      {content}
    </figcaption>
  ) : (
    resolveTheme(themeId).image.caption(content)
  );
  if (!isValidElement<HTMLAttributes<HTMLElement>>(frame)) return frame;
  return cloneElement(frame, {
    "aria-hidden": !visible,
    "aria-live": live,
    "aria-atomic": true,
    style: { ...frame.props.style, visibility: visible ? undefined : "hidden" },
  });
}
