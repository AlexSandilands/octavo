import Image from "next/image";
import type { MontageItem } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";

// The framework-agnostic half of the montage block (issue #95): resolving its
// slides, and the deterministic single-frame rendering used wherever animation
// would be wrong — the print/PDF document and the admin editor canvas. The
// animated widget is its client-only counterpart (montage-player.tsx), rendered
// only when a reader asks for it (`interactive` in BlockView). The print route
// therefore never renders the player: nothing hydrates, no timer starts, and
// the printed frame is always the first slide.

export type MontageSlide = { image: ResolvedImage; alt: string };

// The block's items joined to their resolved images, in authored order. An item
// whose image no longer resolves (deleted row) is dropped rather than rendered
// as a gap — the montage just gets shorter, mirroring how a deleted sponsor
// hides its slot.
export function resolveMontageSlides(
  items: MontageItem[],
  images: ImageMap | undefined,
): MontageSlide[] {
  const slides: MontageSlide[] = [];
  for (const item of items) {
    const image = images?.[item.imageId];
    if (image) slides.push({ image, alt: item.alt });
  }
  return slides;
}

// The aspect ratio the montage box holds, taken from the first slide so the
// frame is one stable shape for the whole montage — the page never reflows as
// the images cross-fade, which matters on a fixed design canvas where a
// resizing block would push everything below it. Slides that don't match this
// shape are letterboxed into it, never cropped (see MontageFrame). Falls back
// to 3:2 when the record predates stored dimensions.
export function montageAspectRatio(slides: MontageSlide[]): number {
  const first = slides[0]?.image;
  if (first?.width && first?.height) return first.width / first.height;
  return 3 / 2;
}

// How the frame fills the space around a slide whose aspect ratio differs from
// the montage's — every slide is shown whole (object-contain), so a mixed set of
// portrait/landscape/square photos leaves letterbox or pillarbox bars.
//
//   "wash" — a quiet paper-tone panel behind the photo.
//   "blur" — the slide itself, scaled up and blurred, as a lightbox underlay.
//
// We ship "wash". Both were built and compared side by side on a deliberately
// mixed set (issue #95 review): the wash holds the editorial direction the rest
// of the magazine is built on — restrained paper palette, hairline borders, no
// glassy effects (docs/design-principles.md §6) — and it keeps the photo the
// only thing on the page competing for attention. The blurred underlay reads as
// a media player rather than a magazine, and it fights the classic theme's
// printed-page frame in particular. It is also the safer print: a flat panel
// rasterises identically in Chromium's PDF, where a large CSS blur is both
// expensive and a rendering variable we would rather not carry into a cached
// artifact.
export type MontageFill = "wash" | "blur";

export const MONTAGE_FILL: MontageFill = "wash";

// One montage frame, filling a positioned ancestor. Shared by the static render
// below and the player's cross-fade stack so both letterbox identically.
export function MontageFrame({
  slide,
  priority = false,
  fill = MONTAGE_FILL,
}: {
  slide: MontageSlide;
  priority?: boolean;
  /** Overridable so the two treatments can be compared; production uses MONTAGE_FILL. */
  fill?: MontageFill;
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${
        fill === "wash" ? "bg-stage" : ""
      }`}
    >
      {fill === "blur" && (
        // Decorative: the same photo, overscaled so the blur's soft edges fall
        // outside the frame. Hidden from assistive tech — the real slide below
        // carries the alt text.
        <Image
          src={slide.image.url}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 768px) 100vw, 480px"
          className="scale-125 object-cover blur-2xl"
          unoptimized
        />
      )}
      <Image
        src={slide.image.url}
        alt={slide.alt}
        fill
        sizes="(max-width: 768px) 100vw, 480px"
        // contain, not cover: a montage may mix portrait, landscape and square
        // photos, and cropping someone's photo to fit the first one's shape is
        // not a decision the renderer gets to make.
        className="object-contain"
        priority={priority}
        // Same reasoning as BlockImage: the upload pipeline already emits final,
        // capped WebP, so /_next/image would only move bytes onto the container.
        unoptimized
      />
    </div>
  );
}

// The montage as one still picture — its first slide, always. This is what the
// PDF prints (deterministic: no timers, no hydration, no "which frame did we
// catch") and what the editor canvas shows while authoring; the slide list is
// managed in the montage dialog, not by watching the canvas cycle.
//
// The frame takes its ratio from that same first slide, so the still normally
// fills it edge to edge with no bars at all. It can still letterbox — a stored
// image without dimensions falls back to 3:2 — and when it does, the fill
// treatment paints a deliberate panel rather than leaving a hole in the page.
export function MontageStill({
  slides,
  priority = false,
}: {
  slides: MontageSlide[];
  priority?: boolean;
}) {
  const first = slides[0];
  if (!first) return null;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: montageAspectRatio(slides) }}
    >
      <MontageFrame slide={first} priority={priority} />
    </div>
  );
}
