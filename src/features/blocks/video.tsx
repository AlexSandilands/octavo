import Image from "next/image";
import { Icon } from "@/components/icons";
import type { ResolvedImage } from "@/lib/images";
import { youtubeWatchLabel, youtubeWatchUrl } from "@/lib/youtube";

// The framework-agnostic half of the video block (issue #161): the frame, the
// poster, the play mark, and the deterministic still used wherever a player
// would be wrong — the print/PDF document and the admin editor canvas. The
// facade that actually loads YouTube is its client-only counterpart
// (video-player.tsx), rendered only when a reader asks for it (`interactive` in
// BlockView). The print route therefore never renders it: nothing hydrates, no
// frame is requested, and the printed page is always poster + link.

// Videos are 16:9. Unlike a montage — whose frame takes its shape from the first
// photo — this ratio belongs to the medium, not to the picture we happen to
// hold, so the box is 16:9 even when the stored poster is not (hqdefault is 4:3
// with the real frame letterboxed inside it, which object-cover crops back off).
export const VIDEO_ASPECT = 16 / 9;

// The poster frame filling a positioned ancestor, or the quiet panel that stands
// in when we have no poster (the capture failed, or the block predates one).
// Decorative on purpose: the play control names the video, and the caption
// describes it — a second description of the same still would only be read out
// twice.
export function VideoPoster({
  poster,
  priority = false,
}: {
  poster: ResolvedImage | undefined;
  priority?: boolean;
}) {
  if (!poster) return <div className="bg-stage absolute inset-0" />;
  return (
    <Image
      src={poster.url}
      alt=""
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      className="object-cover"
      priority={priority}
      // Same reasoning as BlockImage: the pipeline already emits final, capped
      // WebP, so /_next/image would only move bytes onto the container.
      unoptimized
    />
  );
}

// The play disc, ~64px so it clears the 44px tap-target guideline with room to
// spare — this is the one control on the block and the audience is older. Card
// on a hairline (the montage chip's treatment) rather than anything painted
// straight onto the photo, so the contrast it is read against is ours and not
// whatever the poster happens to be.
export function PlayMark({ hover = false }: { hover?: boolean }) {
  return (
    <span
      className={`border-hair bg-card text-ink flex h-16 w-16 items-center justify-center rounded-full border shadow-[0_2px_12px_rgba(40,36,28,0.3)] transition-[color,border-color,transform] duration-150 ${
        hover
          ? "group-hover/video:border-accent group-hover/video:text-accent motion-safe:group-hover/video:scale-105"
          : ""
      }`}
    >
      {/* Nudged right by a pixel: a triangle's visual centre sits left of its
          bounding box, and centred geometry reads as off-centre. */}
      <Icon name="play" size={30} className="translate-x-[1px]" />
    </span>
  );
}

// The link as printed, rendered under the caption (the caption belongs to the
// picture; the address is the credit line beneath the whole figure). A PDF
// cannot play anything, so the one thing a reader holding paper needs is the
// address, in text they can type — the same "deterministic single
// representation" call the montage makes when it prints only its first slide. On
// screen (the editor canvas) it is the same line without the anchor, so an admin
// mid-edit can't click their way out of the editor; on the print page it is a
// real <a>, which Chromium's page.pdf() turns into a live link annotation as
// well as visible text.
export function VideoLink({
  videoId,
  asLink,
}: {
  videoId: string;
  asLink: boolean;
}) {
  const label = youtubeWatchLabel(videoId);
  const line = (
    <>
      <Icon name="play" size={11} className="translate-y-[1px]" />
      {label}
    </>
  );
  const className =
    "text-accent mt-1 inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold tracking-[0.02em] no-underline";
  return asLink ? (
    <a
      href={youtubeWatchUrl(videoId)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {line}
    </a>
  ) : (
    <span className={className}>{line}</span>
  );
}

// The video as one still: its poster with a play mark, so the page says "video"
// at a glance. This is what the PDF prints and what the editor canvas shows
// while authoring — no timers, no hydration, nothing third-party requested. Its
// other half is VideoLink, which BlockView places under the caption.
export function VideoStill({
  poster,
  priority = false,
}: {
  poster: ResolvedImage | undefined;
  priority?: boolean;
}) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: VIDEO_ASPECT }}
    >
      <VideoPoster poster={poster} priority={priority} />
      <span
        // Decorative: there is nothing to press on a printed page, and in the
        // editor the block's own controls do the work.
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
      >
        <PlayMark />
      </span>
    </div>
  );
}
