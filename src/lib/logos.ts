import type { ResolvedImage } from "./images";

// The logo library: a named mark (transparent PNG/WebP) other features can
// reference by id. This file holds the framework-agnostic shape; the DB lookup
// lives in `server/logos.ts`, mirroring how sponsors/images are split.

// The admin-list shape: a logo row with its mark resolved to a ready-to-render
// URL. `image` is non-null because `logos.imageId` is — a logo is its mark.
export type LogoListItem = {
  id: string;
  name: string;
  imageId: string;
  image: ResolvedImage;
};
