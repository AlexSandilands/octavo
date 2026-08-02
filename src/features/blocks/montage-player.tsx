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
// holds one stable aspect ratio (see montageAspectRatio) and letterboxes any
// slide that differs rather than cropping it, so the page never reflows mid-fade
// — important on the fixed design canvas, where a resizing block would push the
// rest of the page.
//
// Accessibility (the audience is older and phone-heavy):
//   * The arrows hug the frame edges as small ~30px discs, but each sits in a
//     44px button, so the tap target clears the 44px guideline even though the
//     visible circle is smaller.
//   * They are revealed on hover ONLY where hovering is possible. The default
//     is visible, and `(hover: hover)` — a device with a real pointer — is what
//     opts into hiding them. A phone therefore always shows them; no capability
//     detection can leave a touch user with no way to advance.
//   * Keyboard focus anywhere in the widget reveals them too, and they are only
//     ever faded (opacity), never removed from the accessibility tree or the tab
//     order, so tabbing to an "invisible" arrow brings it into view.
//   * Only the visible slide is exposed to assistive tech; left/right arrow keys
//     drive the montage when focus is inside it and are stopped from reaching
//     the reader's page-turn handler.
//   * The cross-fade is CSS, so motion-reduce turns it into an instant swap
//     while the arrows keep working (autoplay is separately disabled — see
//     useMontage).

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
      // A *named* group: EditorBlock and other ancestors use the bare `group`
      // class, and an unnamed group-hover would match those too.
      className="group/montage relative w-full overflow-hidden"
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
          {/* Always visible — never hover-gated. It is the only thing telling a
              reader the montage has more in it, so it has to be legible before
              any interaction. Sized down ~15% from the original chip. */}
          <p className="border-hair bg-card text-ink absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-2.5 py-[3px] font-sans text-[10px] font-semibold tabular-nums shadow-[0_2px_10px_rgba(40,36,28,0.22)]">
            <span className="sr-only">Image </span>
            {index + 1} / {slides.length}
          </p>
        </>
      )}
    </div>
  );
}

// A step control hugging one edge of the frame: a small ~30px disc inside a
// 44px button, so it stays a comfortable tap target while reading as a light
// touch over the photo.
//
// The reveal rule is written "visible by default, hidden only under
// (hover: hover)" rather than the other way round. That ordering is the whole
// accessibility argument: any device we fail to recognise — and every touch
// device — falls through to the visible state, so nobody is left tapping a
// photo wondering how to see the next one. Opacity (not visibility/display)
// keeps the button focusable while faded, and focus inside the widget brings it
// back.
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
      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/montage:opacity-100 [@media(hover:hover)]:group-focus-within/montage:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <span className="border-hair bg-card text-ink group-hover/montage:border-accent flex h-[30px] w-[30px] items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(40,36,28,0.24)]">
        <Icon
          name={side === "left" ? "chevronLeft" : "chevronRight"}
          size={17}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
