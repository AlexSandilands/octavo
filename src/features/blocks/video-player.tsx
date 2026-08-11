"use client";

import { useEffect, useRef, useState } from "react";
import type { ResolvedImage } from "@/lib/images";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { PlayMark, VideoPoster, VIDEO_ASPECT } from "./video";

// The playable video (issue #161), rendered only on the read path — both the
// desktop flipbook and the mobile scroll reader mount this one widget. The
// print/PDF document and the editor canvas render VideoStill instead.
//
// It is a *facade*, not an iframe: what the page loads is our own stored poster
// and a button, and the YouTube frame is injected only when a member presses
// play. That matters twice over for this audience. It keeps first paint to one
// image on the phone connections the product targets, where an embed would pull
// down the better part of a megabyte of player before anyone had asked for
// anything. And it means a reader who never presses play loads no third-party
// frame and is handed no third-party cookie — which is also why the frame, when
// it does come, comes from youtube-nocookie.com (the one origin `frame-src`
// allows; see src/middleware.ts).
//
// Accessibility (the audience is older and phone-heavy):
//   * The control is a real <button> covering the whole poster — a 16:9 tap
//     target on a phone, far past the 44px guideline — with the disc as its
//     visible mark. It names the video and says where pressing it will take
//     them, because loading a third party is worth warning about.
//   * It is visible from the start, never hover-gated: unlike the montage's step
//     arrows there is no second way to discover it, so it cannot be hidden from
//     anyone on any device.
//   * On activation focus moves into the frame. The button that had focus has
//     just unmounted, so without this the keyboard would be dropped on <body>
//     mid-page (the papercut #131 was about) — and the player is the thing they
//     asked for, so it is where they should land.
//   * Never autoplays on load. `autoplay=1` is on the *activated* URL only: the
//     press is the play action, and starting a video nobody asked for would be
//     both rude and expensive.
export function VideoPlayer({
  videoId,
  poster,
  label,
}: {
  videoId: string;
  poster: ResolvedImage | undefined;
  /** The block's caption, used to name the video when there is one. */
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  const name = label ? `${label} (video)` : "Video";

  return (
    <div
      className="group/video bg-stage relative w-full overflow-hidden"
      style={{ aspectRatio: VIDEO_ASPECT }}
    >
      {playing ? (
        <iframe
          ref={frameRef}
          // autoplay because the press *was* the play; the rest keeps YouTube's
          // own chrome as quiet as it lets us (rel=0 confines the end-screen
          // suggestions to this channel, playsinline stops iOS taking the video
          // fullscreen out from under the reader).
          src={`${youtubeEmbedUrl(videoId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={name}
          // Only what a video player needs. `allow-same-origin` is safe here
          // precisely because the frame is cross-origin: it grants the frame its
          // own origin, not ours — the sandbox-escape caveat applies to a
          // same-origin frame, which this can never be. Top-level navigation is
          // absent from the list, so a compromised embed cannot redirect the
          // member's page out from under them.
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <>
          <VideoPoster poster={poster} priority />
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${name} on YouTube`}
            // The focus ring is pulled inside the frame: the global one sits 2px
            // outside the element, and this button fills a box that clips.
            className="absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:[outline-offset:-4px]"
          >
            <PlayMark hover />
          </button>
        </>
      )}
    </div>
  );
}
