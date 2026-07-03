import { NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@/lib/id";
import { processImage, UnsupportedImageError } from "@/lib/image-processing";
import { keyToUrl, putObject, usingLocalStorage } from "@/lib/storage";
import { createImageRecord } from "@/server/images";
import { getAdminUser } from "@/server/session";

// Admin image upload. Receives one file as multipart form data, re-encodes it to
// WebP, stores it in R2 and records it in the DB. Returns the imageId + public
// URL the editor writes onto the image block.
//
// A route handler (not a server action) because file uploads exceed the server
// action body limit and binary form data is a poor fit for actions.

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB raw upload
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const fieldsSchema = z.object({
  issueId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 12 MB)." },
      { status: 413 },
    );
  }
  if (file.type && !ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type." },
      { status: 415 },
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
      return NextResponse.json(
        { error: "Unsupported image type." },
        { status: 415 },
      );
    }
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
    return NextResponse.json(
      { error: "Upload failed. Check storage configuration." },
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
