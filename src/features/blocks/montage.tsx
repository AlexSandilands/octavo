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
// frame is stable as the images cross-fade (later slides are cropped to it with
// object-fit). Falls back to 3:2 when the record predates stored dimensions.
export function montageAspectRatio(slides: MontageSlide[]): number {
  const first = slides[0]?.image;
  if (first?.width && first?.height) return first.width / first.height;
  return 3 / 2;
}

// One montage frame, filling a positioned ancestor. Shared by the static render
// below and the player's cross-fade stack so both crop identically.
export function MontageFrame({
  slide,
  priority = false,
}: {
  slide: MontageSlide;
  priority?: boolean;
}) {
  return (
    <Image
      src={slide.image.url}
      alt={slide.alt}
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      className="object-cover"
      priority={priority}
      // Same reasoning as BlockImage: the upload pipeline already emits final,
      // capped WebP, so /_next/image would only move bytes onto the container.
      unoptimized
    />
  );
}

// The montage as one still picture — its first slide, always. This is what the
// PDF prints (deterministic: no timers, no hydration, no "which frame did we
// catch") and what the editor canvas shows while authoring; the slide list is
// managed in the montage dialog, not by watching the canvas cycle.
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
