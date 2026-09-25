import type { Page } from "@/lib/blocks";
import type { PageFill } from "./page-fill";

// Everything the projection reads about the issue being edited (#309). Plain
// data, no DOM, so the projection stays pure and checkable in a script.

/** A photo's natural size; the id stays opaque, so shape is all the model learns. */
export type PhotoShape = { width: number | null; height: number | null };

export type AssistantIssue = {
  title: string;
  theme: string;
  pages: Page[];
  /** Every photo the editor can resolve, by id (placed or not). */
  images: Record<string, PhotoShape>;
  /** Photos uploaded to this issue, placed or not (`images.issue_id`). */
  uploads: string[];
  logos: { id: string; name: string; imageId: string }[];
  sponsorNames: string[];
  /** Page id → the editor's measured fill; a missing page reads "not measured". */
  fills: Record<string, PageFill>;
  /** Which cover tools the run offers (#313); none means covers are read-only. */
  coverTools?: "compose" | "style";
};
