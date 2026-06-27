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

// Every imageId referenced by image blocks in an issue (deduped).
export function collectImageIds(content: IssueContent): string[] {
  const ids = new Set<string>();
  for (const page of content.pages) {
    for (const block of page.blocks) {
      if (block.type === "image" && block.imageId) ids.add(block.imageId);
    }
  }
  return [...ids];
}
