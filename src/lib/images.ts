import type { IssueContent } from "./blocks";

// Image blocks store only an `imageId`. To render, the server resolves those ids
// to public R2 URLs (+ intrinsic size) and hands the result to the renderers as
// a map. This file holds the framework-agnostic shape + the content traversal;
// the actual DB/R2 lookup lives in `server/images.ts`.

export type ResolvedImage = {
  url: string;
  width: number | null;
  height: number | null;
};

// imageId -> resolved R2 image.
export type ImageMap = Record<string, ResolvedImage>;

// Every imageId referenced by an issue's blocks (deduped) — image, montage and
// video alike. Accepts any pages-holding shape so callers can resolve a subset
// (e.g. just the covers). A montage contributes one id per slide and a video its
// stored poster frame, so a single resolve call still gives the renderers
// everything a page needs. This is the only traversal that feeds the ImageMap,
// so a block type that references an image and is missed here resolves to
// nothing on every surface at once.
export function collectImageIds(
  content: Pick<IssueContent, "pages">,
): string[] {
  const ids = new Set<string>();
  for (const page of content.pages) {
    for (const block of page.blocks) {
      if (block.type === "image" && block.imageId) ids.add(block.imageId);
      if (block.type === "montage") {
        for (const item of block.items) ids.add(item.imageId);
      }
      if (block.type === "video" && block.posterImageId) {
        ids.add(block.posterImageId);
      }
    }
  }
  return [...ids];
}
