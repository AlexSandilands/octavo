import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { images, logos } from "@/db/schema";
import {
  AI_PHOTO_EDGE,
  aiPhotoRequestSchema,
  type AiPhotoResponse,
} from "@/lib/ai-vision-contract";
import { collectImageIds } from "@/lib/images";
import { createRateLimiter } from "@/lib/rate-limit";
import { getObject } from "@/lib/storage";
import { readDraftRequest } from "@/server/ai-render/admin-request";

// One of the issue's photos for `view_photo` (#342), downscaled to 800px on the
// long edge as a JPEG. Only this issue's photos: uploaded to it, or placed in
// it as saved. A mark from the logo library is not a photo, so it's refused.
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, windowMs: 10 * 60_000 });
const refused = () =>
  NextResponse.json(
    { error: "That isn't one of this issue's photos." },
    { status: 404 },
  );

export async function POST(request: Request) {
  const req = await readDraftRequest(request, {
    schema: aiPhotoRequestSchema,
    maxBytes: 1_024,
    limiter,
  });
  if (!req.ok) return req.response;
  const { imageId } = req.data;

  const [row] = await db
    .select({ key: images.key, issueId: images.issueId })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);
  const ours =
    row &&
    (row.issueId === req.issue.id ||
      collectImageIds(req.issue.content).includes(imageId));
  if (!ours) return refused();
  const [mark] = await db
    .select({ id: logos.id })
    .from(logos)
    .where(eq(logos.imageId, imageId))
    .limit(1);
  if (mark) return refused();

  const bytes = await getObject(row.key);
  if (!bytes) return refused();
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({
      width: AI_PHOTO_EDGE,
      height: AI_PHOTO_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const body: AiPhotoResponse = {
    mediaType: "image/jpeg",
    data: data.toString("base64"),
    width: info.width,
    height: info.height,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
