import type { IssueContent } from "./blocks";
import { imageSites, siteImageId } from "./image-sites";

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

// Every imageId an issue references (deduped). Accepts any pages-holding shape
// so callers can resolve a subset, e.g. just the covers. The traversal lives in
// image-sites.ts because the import's rewrite must walk exactly the same sites.
export function collectImageIds(
  content: Pick<IssueContent, "pages">,
): string[] {
  const ids = new Set<string>();
  for (const site of imageSites(content)) {
    const id = siteImageId(site);
    if (id) ids.add(id);
  }
  return [...ids];
}
