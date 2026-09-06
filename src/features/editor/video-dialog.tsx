"use client";

import { useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { DialogActions, DialogHeader } from "@/components/dialog-parts";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { parseYouTubeId, youtubeWatchLabel } from "@/lib/youtube";

// The video block's settings panel (issue #161): paste a YouTube link, see what
// it resolved to, and keep the poster frame that gets captured from it. A dialog
// rather than the image block's floating strip because a link field wants room —
// for the address itself, for a refusal that explains itself, and for the poster
// preview that proves the right video was understood.
//
// The preview is a still, never a player: the editor has no business loading a
// third-party frame while someone is typing, and the poster is exactly what the
// page will show a reader anyway.
//
// Pressing "Use this link" captures the poster through POST
// /api/admin/video-poster — the ordinary image pipeline with a fetch on the
// front of it — and hands the stored image back to the editor so the canvas
// previews immediately. Pressing it on the link already in use ("Refresh
// image") captures it again: our copy of the poster is a snapshot, and taking
// it again is the documented way to catch up with a thumbnail the uploader has
// since changed. Every edit writes back through the block's normal `onChange`,
// so it rides the existing autosave; this dialog persists nothing itself.

export function VideoDialog({
  videoId,
  posterImageId,
  issueId,
  images,
  onChangeVideo,
  onRegisterImage,
  onClose,
}: {
  videoId: string | undefined;
  posterImageId: string | undefined;
  issueId: string;
  images: ImageMap;
  onChangeVideo: (next: {
    videoId: string | undefined;
    posterImageId: string | undefined;
  }) => void;
  onRegisterImage: (imageId: string, image: ResolvedImage) => void;
  onClose: () => void;
}) {
  // Seeded from the stored id as the link it came from, so reopening the dialog
  // shows the admin something they recognise rather than a bare token.
  const [url, setUrl] = useState(videoId ? youtubeWatchLabel(videoId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validated on every keystroke, and it is the *parse* that decides — the same
  // function the block schema's id format comes from, so what the editor accepts
  // and what the document can hold cannot drift apart.
  const typed = url.trim();
  const parsed = parseYouTubeId(url);
  const unusable = typed !== "" && !parsed;
  const poster = posterImageId ? images[posterImageId] : undefined;
  // The link already in use. It does NOT disable the button: capturing the same
  // link again is how a poster is refreshed after the uploader changes their
  // thumbnail, which is the accepted cost of holding our own copy (issue #161).
  // It only changes what the button calls itself, so pressing it says what it
  // will do rather than repeating "use this link" at someone already using it.
  const isCurrent = Boolean(parsed && parsed === videoId);

  const apply = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video-poster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId: parsed, issueId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not add that video.");
      onRegisterImage(data.imageId, {
        url: data.url,
        width: data.width,
        height: data.height,
      });
      onChangeVideo({ videoId: parsed, posterImageId: data.imageId });
    } catch (err) {
      // The block is only written once the poster is stored, so a failure here
      // leaves it exactly as it was rather than half-applied — a refresh that
      // fails keeps the poster it already had.
      setError(
        err instanceof Error ? err.message : "Could not add that video.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    // Same isolation as the montage dialog: it floats over the editor canvas,
    // which deselects the block on a stray click and pans on a drag.
    <DialogShell
      panelClassName="flex flex-col md:w-[580px]"
      isolatePointerEvents
      locked={busy}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <DialogHeader
            titleId={titleId}
            title="Video"
            onClose={onClose}
            closeDisabled={busy}
          />

          <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-5 pt-6 [--scrollbar-surface:var(--color-surface)] [scrollbar-gutter:stable] md:px-8">
            <label className="block">
              <span className="text-fg-muted mb-2 block font-ui text-[14px] font-bold tracking-[0.06em] uppercase">
                YouTube link
              </span>
              {/* The focus ring goes on the decorated box, not the bare input
                  inside it (the .boxed-field pattern in globals.css). */}
              <span
                className={`boxed-field bg-surface flex h-12 items-center rounded-field border-[1.5px] px-4 ${
                  unusable ? "border-danger" : "border-edge"
                }`}
              >
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void apply();
                  }}
                  disabled={busy}
                  maxLength={2000}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={unusable || undefined}
                  aria-describedby={`${titleId}-hint`}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="text-fg placeholder:text-fg-faint min-w-0 flex-1 bg-transparent font-ui text-[16px] outline-none"
                />
              </span>
            </label>

            {/* One line under the field, always present, saying where the link
                stands. A refusal has to read as an instruction to an audience
                that did nothing wrong — they pasted what their browser gave
                them — so it names the forms that do work. */}
            <p
              id={`${titleId}-hint`}
              className={`mt-2 font-ui text-[15px] leading-relaxed ${
                unusable ? "text-danger font-bold" : "text-fg-muted"
              }`}
            >
              {unusable
                ? "That isn't a YouTube link. Paste the address from the video's page or its Share button."
                : parsed
                  ? isCurrent
                    ? `Showing ${youtubeWatchLabel(parsed)}.`
                    : `Ready: ${youtubeWatchLabel(parsed)}.`
                  : "Paste a link from YouTube — the watch page, the Share button, or a Shorts link. Extra bits like a start time are ignored."}
            </p>

            <div className="mt-6">
              <span className="text-fg-muted mb-2 block font-ui text-[14px] font-bold tracking-[0.06em] uppercase">
                Video image
              </span>
              {poster && videoId ? (
                <div className="bg-surface-2 flex items-center gap-3 rounded-field p-2.5">
                  <div className="border-hairline bg-surface relative h-[72px] w-32 flex-none overflow-hidden rounded-[8px] border">
                    {/* A plain <img>: this is chrome, not page content, and the
                        montage dialog's row previews do the same. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={poster.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="text-surface absolute inset-0 flex items-center justify-center">
                      <span className="bg-scrim flex h-8 w-8 items-center justify-center rounded-full">
                        <Icon name="play" size={16} />
                      </span>
                    </span>
                  </div>
                  <p className="text-fg-muted min-w-0 font-ui text-[14px] leading-relaxed">
                    Kept as our own copy, so readers load nothing from YouTube
                    until they press play — and so it prints. If it changes on
                    YouTube, press Refresh image to take it again.
                  </p>
                </div>
              ) : (
                <p className="border-edge text-fg-muted rounded-field border-2 border-dashed px-4 py-6 text-center font-ui text-[15px]">
                  The video&rsquo;s own picture is saved here once you add a
                  link.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-danger flex-none px-5 pt-4 font-ui text-[15px] font-bold md:px-8"
            >
              {error}
            </p>
          )}

          <DialogActions between>
            <Button
              variant="secondary"
              icon="trash"
              onClick={() => {
                setUrl("");
                setError(null);
                onChangeVideo({ videoId: undefined, posterImageId: undefined });
              }}
              disabled={busy || !videoId}
            >
              Remove video
            </Button>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Button
                variant="secondary"
                onClick={() => void apply()}
                busy={busy}
                disabled={!parsed}
              >
                {busy
                  ? isCurrent
                    ? "Refreshing…"
                    : "Adding…"
                  : isCurrent
                    ? "Refresh image"
                    : "Use this link"}
              </Button>
              <Button onClick={onClose} disabled={busy} icon="check">
                Done
              </Button>
            </div>
          </DialogActions>
        </>
      )}
    </DialogShell>
  );
}
