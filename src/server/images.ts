import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";
import { keyToUrl } from "@/lib/storage";
import { collectImageIds, type ImageMap } from "@/lib/images";
import type { IssueContent } from "@/lib/blocks";

// Server-only data access for stored images. Editor and reader resolve the
// imageIds in an issue's content to public URLs through here.

export async function createImageRecord(input: {
  key: string;
  width: number;
  height: number;
  issueId: string | null;
}) {
  const [row] = await db.insert(images).values(input).returning();
  if (!row) throw new Error("Failed to record image");
  return row;
}

export async function getImagesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(images).where(inArray(images.id, ids));
}

// imageId -> { url, width, height } for every image referenced by the content.
// URLs point at R2 or the local dev backend, whichever storage is active.
export async function resolveIssueImages(
  content: Pick<IssueContent, "pages">,
): Promise<ImageMap> {
  const ids = collectImageIds(content);
  if (ids.length === 0) return {};

  const rows = await getImagesByIds(ids);
  const map: ImageMap = {};
  for (const row of rows) {
    map[row.id] = {
      url: keyToUrl(row.key),
      width: row.width,
      height: row.height,
    };
  }
  return map;
}
