import { z } from "zod";
import type { ImageMap } from "@/lib/images";
import type { ReviewItem } from "./model";
import { checkAbort } from "./model";
const uploadSchema = z.object({
  imageId: z.string().uuid(),
  url: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type UploadCache = Map<Blob, z.infer<typeof uploadSchema>>;
export async function uploadSelection(
  items: ReviewItem[],
  issueId: string,
  cache: UploadCache,
  signal: AbortSignal,
) {
  const replacements: Record<string, string> = {},
    images: ImageMap = {};
  for (const item of items) {
    checkAbort(signal);
    if (item.block.type !== "image" || !item.region.image) continue;
    const { image } = item.region;
    let result = cache.get(image.blob);
    if (!result) {
      if (image.blob.size > 12 * 1024 * 1024)
        throw new Error(
          "Selected image exceeds the 12 MB upload limit. Choose a smaller image.",
        );
      const form = new FormData();
      form.append("file", image.blob, "selected-image.png");
      form.append("issueId", issueId);
      form.append("importDraft", "true");
      // Let an already-sent upload settle so a cancelled retry can reuse its record.
      const response = await fetch("/api/admin/images", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Upload rate limit reached. Wait one minute and retry; completed images will be reused."
            : "Image upload failed. Check that this issue is still a draft, then retry. Completed images will be reused.",
        );
      result = uploadSchema.parse(await response.json());
      cache.set(image.blob, result);
    }
    checkAbort(signal);
    replacements[item.block.imageId ?? item.id] = result.imageId;
    images[result.imageId] = {
      url: result.url,
      width: result.width,
      height: result.height,
    };
  }
  return { replacements, images };
}
