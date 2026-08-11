"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import type { BlockPatch } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { youtubeWatchLabel } from "@/lib/youtube";
import { VideoDialog } from "./video-dialog";

// The video block's entry in the selected-block toolbar: what it is showing, and
// a button to change it. The link field and its refusals need more room than a
// floating strip has, so — like the montage — the work happens in a dialog.
//
// The panel is portalled to <body> deliberately: the editor canvas sits under a
// `transform: scale()` (ScaledPage), and a position:fixed descendant of a
// transformed element is positioned against that element, not the viewport — so
// rendering the modal in place would pin it to the page canvas and scale it.
export function VideoBlockControl({
  videoId,
  posterImageId,
  issueId,
  images,
  onChange,
  onRegisterImage,
}: {
  videoId: string | undefined;
  posterImageId: string | undefined;
  issueId: string;
  images: ImageMap;
  onChange: (patch: BlockPatch) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="border-hair text-ink hover:border-accent flex h-7 items-center gap-1.5 rounded-[6px] border bg-white px-2.5 font-sans text-[12px] font-semibold"
      >
        <Icon name="play" size={13} className="text-accent" />
        {videoId ? youtubeWatchLabel(videoId) : "Add a video link"}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <VideoDialog
            videoId={videoId}
            posterImageId={posterImageId}
            issueId={issueId}
            images={images}
            onChangeVideo={(next) => onChange(next)}
            onRegisterImage={onRegisterImage}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
