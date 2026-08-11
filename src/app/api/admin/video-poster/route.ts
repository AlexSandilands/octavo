import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@/lib/id";
import { processImage, UnsupportedImageError } from "@/lib/image-processing";
import { createRateLimiter } from "@/lib/rate-limit";
import { keyToUrl, putObject, usingLocalStorage } from "@/lib/storage";
import { YOUTUBE_ID_RE } from "@/lib/youtube";
import { fetchYouTubePoster } from "@/lib/youtube-poster";
import { createImageRecord } from "@/server/images";
import { getAdminUser } from "@/server/session";

// Video poster capture (issue #161). Takes a validated YouTube video id, fetches
// that video's poster frame once, and stores it exactly like an uploaded photo —
// same sharp re-encode, same R2 key layout, same `images` row. It answers in the
// upload route's shape, so the editor writes the returned imageId onto the block
// through the identical code path an upload uses.
//
// Fetching the poster at edit time (rather than pointing the readers at
// i.ytimg.com) is what keeps a member's browser away from every Google origin
// until they actually press play, and it is what makes the poster printable —
// the PDF container already reaches our storage. The cost, accepted in the issue
// thread: if the uploader later changes their thumbnail our copy goes stale, and
// re-pasting the link is the refresh.
//
// A route handler rather than a server action for the same reason the upload is
// one: it belongs next to /api/admin/images, and the editor calls both the same
// way.

const bodySchema = z.object({
  // The id, not a URL — the client parses the pasted link (lib/youtube.ts) and
  // sends only what came out of it. Re-validated here because a route handler
  // trusts nothing from the client, and because this id is what a URL gets built
  // from downstream.
  videoId: z.string().regex(YOUTUBE_ID_RE),
  issueId: z.string().min(1).optional(),
});

// Tighter than the upload limiter (30/min): each request is an outbound fetch
// *and* a sharp re-encode, and a poster is captured once per video block, not
// once per file in a montage. Still far above what authoring an issue needs.
const posterLimiter = createRateLimiter({ limit: 15, windowMs: 60_000 });

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  }

  const rate = posterLimiter.check(admin.id);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many videos at once. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That is not a YouTube video link." },
      { status: 400 },
    );
  }
  const { videoId } = parsed.data;
  const issueId = parsed.data.issueId ?? null;

  let poster: Buffer | null;
  try {
    poster = await fetchYouTubePoster(videoId);
  } catch (err) {
    // The network refused us, or YouTube took longer than the timeout. Nothing
    // the admin can fix by retyping the link, so name it as what it is.
    Sentry.captureException(err, {
      level: "warning",
      tags: { route: "admin/video-poster", stage: "fetch" },
      extra: { adminId: admin.id, videoId },
    });
    return NextResponse.json(
      { error: "Could not reach YouTube for the video image. Try again." },
      { status: 502 },
    );
  }
  if (!poster) {
    // Both poster sizes 404'd. In practice this is a well-formed link to a video
    // that isn't there (deleted, private, or a typo inside the id), which is the
    // one broken case the id regex cannot catch — so it is worth saying plainly.
    return NextResponse.json(
      { error: "No image found for that video. Check the link is public." },
      { status: 404 },
    );
  }

  let processed;
  try {
    // Same pipeline as an upload: sharp checks the *detected* format, caps the
    // pixels and the longest edge, and re-encodes to WebP. Whatever the response
    // headers claimed is irrelevant by the time this returns.
    processed = await processImage(poster);
  } catch (err) {
    if (!(err instanceof UnsupportedImageError)) {
      Sentry.captureException(err, {
        level: "warning",
        tags: { route: "admin/video-poster", stage: "decode" },
        extra: { adminId: admin.id, videoId, sizeBytes: poster.byteLength },
      });
    }
    return NextResponse.json(
      { error: "Could not read the video image." },
      { status: 422 },
    );
  }

  const key = issueId
    ? `issues/${issueId}/${createId()}.webp`
    : `images/${createId()}.webp`;

  try {
    await putObject(key, processed.buffer, processed.contentType);
  } catch (err) {
    console.error("R2 upload failed", err);
    Sentry.captureException(err, {
      tags: { route: "admin/video-poster", stage: "storage" },
      extra: { adminId: admin.id, key, localStorage: usingLocalStorage() },
    });
    return NextResponse.json(
      { error: "Saving the video image failed. Check storage configuration." },
      { status: 500 },
    );
  }

  const record = await createImageRecord({
    key,
    width: processed.width,
    height: processed.height,
    issueId,
  });

  return NextResponse.json({
    imageId: record.id,
    url: keyToUrl(key),
    width: processed.width,
    height: processed.height,
    local: usingLocalStorage(),
  });
}
