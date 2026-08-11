"use client";

import { useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { Icon } from "@/components/icons";
import { Button, IconButton } from "@/components/ui";
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
// previews immediately. Every edit writes back through the block's normal
// `onChange`, so it rides the existing autosave; this dialog persists nothing
// itself.

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
      // The video is only set once its poster is stored, so a failure here
      // leaves the block exactly as it was rather than half-applied.
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
      panelClassName="bg-card flex max-h-[90vh] w-[560px] flex-col rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      isolatePointerEvents
      locked={busy}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="flex flex-none items-center justify-between px-8 pt-7">
            <h2
              id={titleId}
              className="text-ink font-serif text-[26px] leading-tight"
            >
              Video
            </h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6">
            <label className="block">
              <span className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase">
                YouTube link
              </span>
              {/* The focus ring goes on the decorated box, not the bare input
                  inside it (the .boxed-field pattern in globals.css). */}
              <span
                className={`boxed-field flex h-11 items-center rounded-md border bg-white px-3 ${
                  unusable ? "border-warn" : "border-hair"
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
                  className="text-ink min-w-0 flex-1 bg-transparent font-sans text-[14px] outline-none"
                />
              </span>
            </label>

            {/* One line under the field, always present, saying where the link
                stands. A refusal has to read as an instruction to an audience
                that did nothing wrong — they pasted what their browser gave
                them — so it names the forms that do work. */}
            <p
              id={`${titleId}-hint`}
              className={`mt-2 font-sans text-[12.5px] ${
                unusable ? "text-warn font-semibold" : "text-faint2"
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
              <span className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase">
                Video image
              </span>
              {poster && videoId ? (
                <div className="border-hair flex items-center gap-3 rounded-lg border bg-white p-2.5">
                  <div className="border-line bg-page relative h-[72px] w-32 flex-none overflow-hidden rounded">
                    {/* A plain <img>: this is chrome, not page content, and the
                        montage dialog's row previews do the same. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={poster.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="text-paper absolute inset-0 flex items-center justify-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(32,32,28,0.62)]">
                        <Icon name="play" size={16} />
                      </span>
                    </span>
                  </div>
                  <p className="text-faint2 min-w-0 font-sans text-[12.5px]">
                    Kept as our own copy, so readers load nothing from YouTube
                    until they press play — and so it prints. Paste the link
                    again to refresh it.
                  </p>
                </div>
              ) : (
                <p className="border-hair text-faint2 rounded-lg border border-dashed px-4 py-6 text-center font-sans text-[13px]">
                  The video&rsquo;s own picture is saved here once you add a
                  link.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-warn flex-none px-8 pt-4 font-sans text-[13px] font-semibold">
              {error}
            </p>
          )}

          <div className="flex flex-none items-center justify-between px-8 pt-6 pb-7">
            <Button
              variant="secondary"
              onClick={() => {
                setUrl("");
                setError(null);
                onChangeVideo({ videoId: undefined, posterImageId: undefined });
              }}
              disabled={busy || !videoId}
            >
              <Icon name="trash" size={17} className="text-warn" />
              Remove video
            </Button>
            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                onClick={() => void apply()}
                busy={busy}
                disabled={!parsed || isCurrent}
              >
                {busy ? "Adding…" : isCurrent ? "Link in use" : "Use this link"}
              </Button>
              <Button
                onClick={onClose}
                disabled={busy}
                icon="check"
                iconPosition="left"
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </DialogShell>
  );
}
