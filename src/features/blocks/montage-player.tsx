"use client";

import { useRef } from "react";
import { Icon } from "@/components/icons";
import { MontageFrame, montageAspectRatio, type MontageSlide } from "./montage";
import { useMontage } from "./use-montage";

// The animated montage (issue #95), rendered only on the read path — both the
// desktop flipbook and the mobile scroll reader mount this one widget. The
// print/PDF document and the editor canvas render MontageStill instead, so no
// timer or hydration ever touches a deterministic render.
//
// Every slide sits stacked in the frame and only opacity changes, so a
// cross-fade is one compositor-driven property with no layout work. The frame
// itself holds the first slide's aspect ratio and crops the rest to it (see
// montageAspectRatio), so the page never reflows mid-fade — important on the
// fixed design canvas, where a resizing block would push the rest of the page.
//
// Accessibility: arrows are real buttons with labels and 56px hit targets (the
// audience is older and phone-heavy); only the visible slide is exposed to
// assistive tech; left/right arrow keys drive the montage when focus is inside
// it and are stopped from reaching the reader's page-turn handler. The
// cross-fade is CSS, so motion-reduce turns it into an instant swap while the
// arrows keep working (autoplay is separately disabled — see useMontage).

export function MontagePlayer({
  slides,
  intervalSeconds,
  label,
}: {
  slides: MontageSlide[];
  intervalSeconds: number;
  /** The block's caption, used to name the group when there is one. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { index, next, prev, interaction } = useMontage(
    ref,
    slides.length,
    intervalSeconds,
  );

  const many = slides.length > 1;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label ? `Montage: ${label}` : "Image montage"}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: montageAspectRatio(slides) }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        // The desktop reader turns the page on these keys from a window
        // listener. While focus is inside a montage they belong to the montage.
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "ArrowRight") next();
        else prev();
      }}
      {...interaction}
    >
      {slides.map((slide, i) => (
        <div
          key={`${slide.image.url}-${i}`}
          // Only the slide on screen is announced; the rest are stacked beneath
          // it at zero opacity and must not reach a screen reader.
          aria-hidden={i !== index}
          // motion-reduce drops `transition-property` entirely, so a
          // reduced-motion reader gets an instant swap, not a faster fade.
          className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <MontageFrame slide={slide} priority={i === 0} />
        </div>
      ))}

      {many && (
        <>
          <Arrow side="left" label="Previous image" onClick={prev} />
          <Arrow side="right" label="Next image" onClick={next} />
          <p className="border-hair bg-card text-ink absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 font-sans text-[12px] font-semibold tabular-nums shadow-[0_2px_10px_rgba(40,36,28,0.22)]">
            <span className="sr-only">Image </span>
            {index + 1} / {slides.length}
          </p>
        </>
      )}
    </div>
  );
}

// A large, always-visible step control. Deliberately not hover-revealed: the
// audience is phone-heavy (no hover) and older (a control you must discover is
// a control you don't use).
function Arrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`border-hair bg-card text-ink hover:border-accent hover:text-accent absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_2px_10px_rgba(40,36,28,0.22)] ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Icon
        name={side === "left" ? "chevronLeft" : "chevronRight"}
        size={26}
        strokeWidth={2}
      />
    </button>
  );
}
