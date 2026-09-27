// The model's view_page / view_photo in the fixture (#342): the editor's own
// createVision (budget, refusals, captions), with pictures from the harness's
// renderer and the case's image files instead of the admin routes, which need
// a saved draft the fixture never writes.
import sharp from "sharp";
import type { Page } from "../../src/lib/blocks.ts";
import { AI_PHOTO_EDGE } from "../../src/lib/ai-vision-contract.ts";
import {
  createVision,
  type VisionEyes,
} from "../../src/features/editor/assistant/vision.ts";
import type { FixtureIssue } from "../fixtures/assistant/cases.mts";
import type { PageRenderer } from "./render.mts";

export function fixtureVision(
  issue: FixtureIssue,
  renderer: PageRenderer,
  pages: () => Page[],
) {
  const eyes: VisionEyes = {
    pages: async (_source, _issue, numbers) => {
      const now = pages();
      return Promise.all(
        numbers.map(async (page) => ({
          page,
          mediaType: "image/png" as const,
          data: (await renderer.picture(issue, now, page)).toString("base64"),
          cover: Boolean(now[page - 1]?.cover),
          // The caption falls back to the fill the executor measured.
          fill: null,
        })),
      );
    },
    photo: async (_source, imageId) => {
      const img = issue.images.get(imageId);
      if (!img) return null;
      const { data, info } = await sharp(img.file)
        .resize(AI_PHOTO_EDGE, AI_PHOTO_EDGE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      return {
        mediaType: "image/jpeg",
        data: data.toString("base64"),
        width: info.width,
        height: info.height,
      };
    },
  };
  return createVision(eyes);
}
