import type { Block, IssueContent, MontageItem } from "./blocks";
import type { CoverElement } from "./cover-elements";

// The one traversal of every place a document references a stored image.
// Collecting the ids (lib/images.ts, which feeds every renderer's ImageMap) and
// rewriting them (issue transfer's import) are both built on it, so a new
// image-bearing block type is in both or in neither — and because the site
// union is discriminated, a new member breaks the rewrite's switch at compile
// time rather than silently going unrewritten.
//
// Sites hold live references into the document they were read from: a rewriter
// clones first and mutates what it is handed.

type ImageBlock = Extract<Block, { type: "image" }>;
type MontageBlock = Extract<Block, { type: "montage" }>;
type VideoBlock = Extract<Block, { type: "video" }>;
type LogoElement = Extract<CoverElement, { type: "logo" }>;

export type ImageSite =
  | { kind: "block"; block: ImageBlock }
  | { kind: "slide"; block: MontageBlock; item: MontageItem }
  | { kind: "poster"; block: VideoBlock }
  | { kind: "coverLogo"; element: LogoElement };

export function* imageSites(
  content: Pick<IssueContent, "pages">,
): Generator<ImageSite> {
  for (const page of content.pages) {
    for (const element of page.coverElements ?? []) {
      if (element.type === "logo") yield { kind: "coverLogo", element };
    }
    for (const block of page.blocks) {
      if (block.type === "image") yield { kind: "block", block };
      if (block.type === "montage") {
        for (const item of block.items) yield { kind: "slide", block, item };
      }
      if (block.type === "video") yield { kind: "poster", block };
    }
  }
}

/** The image a site currently points at, if it points at one. */
export function siteImageId(site: ImageSite): string | undefined {
  switch (site.kind) {
    case "block":
      return site.block.imageId;
    case "slide":
      return site.item.imageId;
    case "poster":
      return site.block.posterImageId;
    case "coverLogo":
      return site.element.imageId;
  }
}
