import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@/lib/id";
import {
  IMAGE_TOO_LARGE,
  IMAGE_UNSUPPORTED,
  imageUploadRefusal,
  IMAGE_UPLOAD_MAX_BYTES,
} from "@/lib/image-upload-limits";
import { processImage, UnsupportedImageError } from "@/lib/image-processing";
import { createRateLimiter } from "@/lib/rate-limit";
import { keyToUrl, putObject, usingLocalStorage } from "@/lib/storage";
import { createImageRecord } from "@/server/images";
import { sweepOrphanedObjects } from "@/server/asset-cleanup";
import { getAdminUser } from "@/server/session";

// Admin image upload. Receives one file as multipart form data, re-encodes it to
// WebP, stores it in R2 and records it in the DB. Returns the imageId + public
// URL the editor writes onto the image block.
//
// A route handler (not a server action) because file uploads exceed the server
// action body limit and binary form data is a poor fit for actions.

// The multipart wrapper around the file: boundaries, headers, the issue id.
const FORM_OVERHEAD = 64 * 1024;

const fieldsSchema = z.object({
  issueId: z.string().uuid().optional(),
});

// Each request re-encodes up to 12 MB through sharp, so throttle per admin even
// after the auth check — the pixel/byte caps make one request safe, volume is
// the gap. Generous enough that building an image-heavy issue never trips it.
const uploadLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  }

  const rate = uploadLimiter.check(admin.id);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  // The route is outside the proxy (whose 10 MB cut used to bound this by
  // accident), so a body too big for any image is refused before it's read.
  const length = Number(request.headers.get("content-length"));
  if (!length || length > IMAGE_UPLOAD_MAX_BYTES + FORM_OVERHEAD) {
    return NextResponse.json(
      { error: length ? IMAGE_TOO_LARGE : "Upload size unknown." },
      { status: length ? 413 : 411 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const refused = imageUploadRefusal(file);
  if (refused) {
    return NextResponse.json(
      { error: refused },
      { status: refused === IMAGE_TOO_LARGE ? 413 : 415 },
    );
  }

  const fields = fieldsSchema.safeParse({
    issueId: form.get("issueId") ?? undefined,
  });
  if (!fields.success) {
    return NextResponse.json({ error: "Invalid fields." }, { status: 400 });
  }
  const issueId = fields.data.issueId ?? null;

  let processed;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // processImage checks the *detected* format (not the claimed MIME type)
    // and rejects anything we don't decode — the client-side type check above
    // is a courtesy, not the gate.
    processed = await processImage(input);
  } catch (err) {
    if (err instanceof UnsupportedImageError) {
      return NextResponse.json({ error: IMAGE_UNSUPPORTED }, { status: 415 });
    }
    // A file that passed the size/MIME checks but sharp still couldn't decode:
    // either a corrupt upload or a real decode bug. Report it — the admin only
    // sees "Could not read that image", so this is the sole record.
    Sentry.captureException(err, {
      level: "warning",
      tags: { route: "admin/images", stage: "decode" },
      extra: {
        adminId: admin.id,
        declaredType: file.type || null,
        sizeBytes: file.size,
      },
    });
    return NextResponse.json(
      { error: "Could not read that image." },
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
    // Storage is down or misconfigured — an infra problem the admin can't fix
    // and the club shouldn't discover first. Alert on it.
    Sentry.captureException(err, {
      tags: { route: "admin/images", stage: "storage" },
      extra: {
        adminId: admin.id,
        key,
        localStorage: usingLocalStorage(),
      },
    });
    return NextResponse.json(
      { error: "Upload failed. Check storage configuration." },
      { status: 500 },
    );
  }

  let record;
  try {
    record = await createImageRecord({
      key,
      width: processed.width,
      height: processed.height,
      issueId,
    });
  } catch {
    await sweepOrphanedObjects({
      keys: [key],
      context: { route: "admin/images", stage: "record" },
    });
    return NextResponse.json(
      {
        error:
          "Could not record the image. Check that the issue still exists and retry.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    imageId: record.id,
    url: keyToUrl(key),
    width: processed.width,
    height: processed.height,
    local: usingLocalStorage(),
  });
}
