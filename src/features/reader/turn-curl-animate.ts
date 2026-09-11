import { lighting, type CurlSample } from "./curl-model";

// Duration of the page-curl, shared with the reader's turn commit timer.
export const FLIP_MS = 700;

/** Deepest shade for a face turned fully from the lamp, and the strongest
 *  sheen for one turned toward it. */
const SHADE = 0.28;
const SHEEN = 0.14;
/** How far the cast shadow reaches past the sheet's footprint, in page widths. */
const PENUMBRA = 0.3;

/**
 * Drive one page turn's Web Animations from the sampled geometry
 * (curl-model.ts): hinge rotations, per-face shading, the still copies
 * clipped to the sheet's footprint, cast shadows, the drop-shadow plate,
 * and — on a cover turn — the reader wrapper's recentre. All linear
 * keyframes on one shared timeline; no per-frame JS.
 */
export function animateCurl(
  root: HTMLElement,
  samples: CurlSample[],
  w: number,
  forward: boolean,
  duration: number,
  recentre: HTMLElement | null,
  coverOpen: boolean,
  coverClose: boolean,
): Animation[] {
  const sign = forward ? 1 : -1;
  const options: KeyframeAnimationOptions = {
    duration,
    fill: "forwards",
    easing: "linear",
  };
  const animations: Animation[] = [];
  const animate = (
    el: Element | null,
    frame: (s: CurlSample) => Keyframe,
    animOptions: KeyframeAnimationOptions = options,
  ) => {
    if (!el) return;
    animations.push(
      el.animate(
        samples.map((s) => ({ ...frame(s), offset: s.t })),
        animOptions,
      ),
    );
  };
  const q = <T extends Element>(sel: string) =>
    Array.from(root.querySelectorAll<T>(sel));

  animate(root.querySelector("[data-root]"), (s) => ({
    transform: `rotateY(${sign * s.root}deg)`,
  }));
  q("[data-joint]").forEach((el, j) =>
    animate(el, (s) => ({ transform: `rotateY(${sign * s.joints[j]!}deg)` })),
  );
  // Each face carries a shade and a sheen overlay per edge; fading them by the
  // lamp's fall on that edge's boundary lights the sheet continuously.
  q<HTMLElement>("[data-shade]").forEach((el) => {
    const [vertex, face, tone] = el.dataset.shade!.split(":");
    const k = Number(vertex);
    const rear = face === "rear";
    const gain = tone === "dark" ? SHADE : SHEEN;
    animate(el, (s) => ({
      opacity: gain * lighting(sign * s.vertices[k]!, rear)[tone as "dark"],
    }));
  });
  // The still copies under the sheet: the origin page shows only where the
  // sheet still covers it, the destination page only where it doesn't.
  animate(root.querySelector("[data-under-origin]"), (s) => ({
    clipPath: forward
      ? `inset(0 ${(1 - s.coverOrigin) * w}px 0 0)`
      : `inset(0 0 0 ${(1 - s.coverOrigin) * w}px)`,
  }));
  animate(root.querySelector("[data-under-dest]"), (s) => ({
    clipPath: forward
      ? `inset(0 ${-s.coverDest * w}px 0 0)`
      : `inset(0 0 0 ${-s.coverDest * w}px)`,
  }));
  // Cast shadows, one per page: a soft band just beyond the sheet's edge,
  // wider and deeper the higher the sheet lifts, that never leaves its page.
  const origin = forward ? "right" : "left";
  const dest = forward ? "left" : "right";
  const castFrame =
    (cover: number, side: "left" | "right") => (s: CurlSample) => ({
      transform: `translateX(${(side === "right" ? 1 : -1) * cover * w}px) scaleX(${Math.max(0, Math.min(PENUMBRA * s.lift, 1 - cover))})`,
      opacity: 0.3 * Math.sqrt(Math.min(1, s.lift)),
    });
  animate(root.querySelector("[data-cast-origin]"), (s) =>
    castFrame(s.coverOrigin, origin)(s),
  );
  animate(root.querySelector("[data-cast-dest]"), (s) =>
    castFrame(-s.coverDest, dest)(s),
  );
  // Opening the cover: blank backing paper only ever under the landed sheet.
  animate(root.querySelector("[data-under-landed]"), (s) => ({
    clipPath: `inset(0 0 0 ${(1 + s.coverDest) * w}px)`,
  }));
  // A cover turn recentres the reader's wrapper on this same timeline, with
  // the root ease rather than the curl's linear one.
  if ((coverOpen || coverClose) && recentre) {
    animate(
      recentre,
      (s) => ({
        transform: `translateX(${coverOpen ? -25 * (1 - s.t) : -25 * s.t}%)`,
      }),
      { ...options, easing: "cubic-bezier(0.3, 0.08, 0.22, 1)" },
    );
  }
  // The drop-shadow plate (issue #215): a cover turn's plate follows the
  // landed/lifting edge instead of staying full width; `data-plate` names
  // which, set by the caller (see turn-curl.tsx).
  const plate = root.querySelector<HTMLElement>("[data-plate]");
  const plateKind = plate?.dataset.plate;
  if (plateKind === "open") {
    animate(plate, (s) => ({
      left: `${50 * (1 + s.coverDest)}%`,
      width: `${50 * (1 - s.coverDest)}%`,
    }));
  } else if (plateKind === "close") {
    animate(plate, (s) => ({
      left: `${50 * (1 - s.coverOrigin)}%`,
      width: `${50 * (1 + s.coverOrigin)}%`,
    }));
  }

  const start = document.timeline.currentTime;
  if (start !== null) animations.forEach((a) => (a.startTime = start));
  return animations;
}
