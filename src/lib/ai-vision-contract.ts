import { z } from "zod";
import { issueContentSchema } from "./blocks";
import { SAVE_REQUEST_MAX_BYTES } from "./editor-save";
import { AI_IMAGE_TYPES } from "./ai-tools";

// The assistant's eyes (#342): the two admin routes the editor calls for
// `view_page`, `view_photo` and the end-of-run review. Client-safe. The model
// never calls these; the editor does, and hands the images back as tool
// results or as the review message's file parts.

export const AI_RENDER_PATH = "/api/admin/ai/render";
export const AI_PHOTO_PATH = "/api/admin/ai/photo";

/** Pages the end-of-run review sends back, the cover first. */
export const AI_REVIEW_MAX_PAGES = 8;
/** A photo's long edge as the model sees it. */
export const AI_PHOTO_EDGE = 800;

/** The issue as the editor holds it now, unsaved edits and all. */
export const aiRenderRequestSchema = z
  .object({
    issueId: z.string().uuid(),
    theme: z.string().max(40),
    logoId: z.string().max(64).nullable(),
    content: issueContentSchema,
    /** 1-based page numbers, in the order the images come back. */
    pages: z
      .array(z.number().int().min(1).max(200))
      .min(1)
      .max(AI_REVIEW_MAX_PAGES),
  })
  .strict();
export type AiRenderRequest = z.infer<typeof aiRenderRequestSchema>;
/** The editor's own save cap, plus room for the other fields. */
export const AI_RENDER_MAX_BYTES = SAVE_REQUEST_MAX_BYTES + 4_096;

export type AiRenderedPage = {
  page: number;
  mediaType: (typeof AI_IMAGE_TYPES)[number];
  /** Base64, no data: prefix. */
  data: string;
  cover: boolean;
  /** Measured as members see it: text area used against the room above the footer. */
  fill: { used: number; avail: number } | null;
};
export type AiRenderResponse = { pages: AiRenderedPage[] };

export const aiPhotoRequestSchema = z
  .object({
    issueId: z.string().uuid(),
    imageId: z.string().min(1).max(64),
  })
  .strict();
export type AiPhotoResponse = {
  mediaType: "image/jpeg";
  data: string;
  width: number;
  height: number;
};
