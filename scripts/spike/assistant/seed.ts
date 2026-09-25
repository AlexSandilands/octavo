// The seed issues without a database: `buildIssues` with every image id minted
// as `img-<key>`, and each image's natural size from the seed manifest so the
// fill estimate and the projection can describe its shape.
import { buildIssues } from "../../../src/db/seed-data.ts";
import { SEED_LOGOS } from "../../../src/db/seed/cover-elements.ts";
import { SEED_IMAGES, type SeedImages } from "../../../src/db/seed/images.ts";
import type { IssueContent } from "../../../src/lib/blocks.ts";

export type ImageInfo = { id: string; width: number; height: number };

export type IssueContext = {
  title: string;
  theme: string;
  content: IssueContent;
  /** Natural sizes of every image the spike knows, keyed by id. */
  images: Map<string, ImageInfo>;
  /** Images uploaded to the issue beyond those it places (a case's `setup`). */
  uploads: ImageInfo[];
  logoNames: string[];
  sponsorNames: string[];
};

const imageIds = new Proxy({} as SeedImages, {
  get: (_, key) => `img-${String(key)}`,
});

export function seedIssues(): IssueContext[] {
  const images = new Map<string, ImageInfo>(
    SEED_IMAGES.map((s) => [
      `img-${s.key}`,
      { id: `img-${s.key}`, width: s.width, height: s.height },
    ]),
  );
  return buildIssues(imageIds).map((issue) => {
    const sponsors = new Set<string>();
    for (const p of issue.content.pages)
      for (const b of p.blocks) if (b.type === "sponsor") sponsors.add(b.name);
    return {
      title: issue.title,
      theme: issue.theme,
      content: issue.content,
      images,
      uploads: [],
      logoNames: SEED_LOGOS.map((l) => l.name),
      sponsorNames: [...sponsors],
    };
  });
}

/** Image ids the issue's blocks reference. */
export function placedImageIds(content: IssueContent): Set<string> {
  const ids = new Set<string>();
  for (const p of content.pages)
    for (const b of p.blocks) {
      if (b.type === "image" && b.imageId) ids.add(b.imageId);
      if (b.type === "montage") for (const it of b.items) ids.add(it.imageId);
      if (b.type === "video" && b.posterImageId) ids.add(b.posterImageId);
    }
  return ids;
}

/** Images the issue may place: its own placed ones plus its unplaced uploads. */
export function issueImageIds(ctx: IssueContext): Set<string> {
  const ids = placedImageIds(ctx.content);
  for (const u of ctx.uploads) ids.add(u.id);
  return ids;
}

/** The MCP server's state file: the context with its image map as a list. */
export type StateFile = Omit<IssueContext, "images"> & { images: ImageInfo[] };

export const toStateFile = (ctx: IssueContext): StateFile => ({
  ...ctx,
  images: [...ctx.images.values()],
});
export const fromStateFile = (s: StateFile): IssueContext => ({
  ...s,
  images: new Map(s.images.map((i) => [i.id, i])),
});
