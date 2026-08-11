import "server-only";
import { YOUTUBE_ID_RE } from "./youtube";

// Fetching a video's poster frame (issue #161). This is the app's only
// server-side outbound fetch, so it is written defensively even though the
// input is already narrow:
//
//   * The URL is built from a hardcoded template with a validated id in it. The
//     pasted link is never fetched — it never even reaches this module. An id
//     that has passed YOUTUBE_ID_RE cannot carry a slash, a dot, a colon or a
//     query, so it cannot steer the request off i.ytimg.com.
//   * Redirects are refused rather than followed, which keeps the request on
//     the host the template names for its whole life.
//   * A timeout, a byte ceiling and a content-type check bound what a bad or
//     slow response can cost us; whatever survives all of that is still handed
//     to sharp, which re-encodes from pixels and trusts no header.
//
// The bytes go on to the ordinary image pipeline (processImage → putObject →
// createImageRecord), so from the moment this returns a poster is just another
// stored image. That is the whole point of fetching it here: the readers, the
// print container and the PDF all reach our own storage and no Google origin.

// Poster sizes, best first. maxresdefault is the 1280×720 source frame but is
// absent for a great many videos (it only exists when the upload was HD), and
// i.ytimg.com answers 404 for it — hqdefault always exists. hqdefault is 4:3
// with the 16:9 frame letterboxed inside it, which the 16:9 render box crops
// back off (object-cover), so the fallback costs resolution, not composition.
const POSTER_NAMES = ["maxresdefault", "hqdefault"] as const;

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024; // a poster is ~100 KB; this is a ceiling, not a budget

/**
 * The best available poster frame for a video, or null when YouTube has none
 * (which is also how a well-formed id for a video that doesn't exist shows up).
 * Throws only on a hard network/timeout failure.
 */
export async function fetchYouTubePoster(
  videoId: string,
): Promise<Buffer | null> {
  // Belt and braces: the callers validate, but this is the function that turns
  // a string into a URL, so it refuses to do that for anything unvalidated.
  if (!YOUTUBE_ID_RE.test(videoId)) {
    throw new Error("Refusing to fetch a poster for a malformed video id");
  }

  for (const name of POSTER_NAMES) {
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/${name}.jpg`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
      cache: "no-store",
      headers: { accept: "image/*" },
    });
    if (!res.ok) continue; // 404: this size doesn't exist for this video

    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) continue;
    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_BYTES) continue;

    const body = Buffer.from(await res.arrayBuffer());
    // Re-check the real length: content-length is a claim, and an absent one
    // would have passed the test above.
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) continue;
    return body;
  }
  return null;
}
