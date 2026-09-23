import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@/lib/id";
import {
  looksLikeImage,
  processAvatar,
  UnsupportedImageError,
} from "@/lib/image-processing";
import { createRateLimiter } from "@/lib/rate-limit";
import { putObject } from "@/lib/storage";
import { sameOrigin } from "@/lib/same-origin";
import { sweepOrphanedObjects } from "@/server/asset-cleanup";
import { discussionOff, INVALID, overLimit } from "@/server/discussion-guard";
import { createImageRecord } from "@/server/images";
import { getMemberIdentity, setNameAvatar } from "@/server/member-names";
import { discardUpload } from "@/server/member-profile";
import { requireMember } from "@/server/session";

// A member's avatar upload (issue #300) — the first upload a non-admin can
// make, so every check runs before the bytes are decoded: session, origin,
// the switch, the name's owner, a budget, then size and a look at the bytes.
// Only then is the photo cropped, stored and recorded, and the image row is
// handed to setNameAvatar here, never by an id from the client.

const MAX_BYTES = 5 * 1024 * 1024;
// Multipart framing around the one file; anything past this is refused unread.
const MAX_BODY = MAX_BYTES + 64 * 1024;

const uploads = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
const nameParam = z.string().min(1).max(64);

const refuse = (status: number, reason: string) =>
  NextResponse.json({ ok: false, reason }, { status });

const TOO_LARGE = "That photo is too large. Choose one under 5 MB.";
const NOT_AN_IMAGE =
  "That file isn't a photo. Choose a JPEG, PNG, WebP, GIF or HEIC image.";

// Reads the body up to the cap and no further; null once it is exceeded.
async function readCapped(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function fileFrom(request: Request): Promise<File | "large" | null> {
  const body = await readCapped(request);
  if (!body) return "large";
  try {
    const form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    return file instanceof File ? file : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let member;
  try {
    member = await requireMember();
  } catch {
    return refuse(401, "Please sign in again to change your photo.");
  }
  if (!sameOrigin(request)) return refuse(403, INVALID.reason);
  const off = await discussionOff();
  if (off) return refuse(403, off.reason);

  // A foreign or unknown name gets the same answer, so neither is revealed.
  const nameId = nameParam.safeParse(
    new URL(request.url).searchParams.get("name"),
  );
  const { names } = await getMemberIdentity(member.id);
  if (!nameId.success || !names.some((n) => n.id === nameId.data)) {
    return refuse(400, INVALID.reason);
  }
  // Spent before the body is read, so no session can stream bodies unmetered;
  // a mistaken file (a PDF, a 6 MB photo) costs one of the five.
  const limited = overLimit(uploads, member.id);
  if (limited) return refuse(429, limited.reason);

  const file = await fileFrom(request);
  if (file === "large") return refuse(413, TOO_LARGE);
  if (!file) return refuse(400, "Choose a photo to upload.");
  if (file.size > MAX_BYTES) return refuse(413, TOO_LARGE);
  const input = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(input)) return refuse(415, NOT_AN_IMAGE);

  let processed;
  try {
    processed = await processAvatar(input);
  } catch (err) {
    if (err instanceof UnsupportedImageError) return refuse(415, NOT_AN_IMAGE);
    Sentry.captureException(err, {
      level: "warning",
      tags: { route: "profile/avatar", stage: "decode" },
      extra: { memberId: member.id, sizeBytes: file.size },
    });
    return refuse(422, "We couldn't read that photo. Try a different one.");
  }

  // Bytes first, then the row, then the name: a failure at any step removes
  // what the steps before it wrote.
  const key = `avatars/${createId()}.webp`;
  try {
    await putObject(key, processed.buffer, processed.contentType);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "profile/avatar", stage: "storage" },
      extra: { memberId: member.id, key },
    });
    return refuse(500, "We couldn't save that photo. Please try again.");
  }

  let imageId: string;
  try {
    const record = await createImageRecord({
      key,
      width: processed.width,
      height: processed.height,
      issueId: null,
    });
    imageId = record.id;
  } catch (err) {
    await sweepOrphanedObjects({
      keys: [key],
      context: { route: "profile/avatar", stage: "record" },
    });
    Sentry.captureException(err, {
      tags: { route: "profile/avatar", stage: "record" },
    });
    return refuse(500, "We couldn't save that photo. Please try again.");
  }

  try {
    const result = await setNameAvatar({ nameId: nameId.data, imageId });
    if (!result.ok) {
      await discardUpload(imageId);
      return refuse(400, result.reason);
    }
  } catch (err) {
    await discardUpload(imageId);
    throw err;
  }
  return NextResponse.json({ ok: true });
}
