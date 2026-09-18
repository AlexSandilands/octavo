import { z } from "zod";
import { ISSUE_TITLE_MAX } from "../editor-save";
import { MAX_BUNDLE_ENTRIES, MAX_BUNDLE_ISSUES } from "./limits";

// The write-free look-ahead behind the modal's Review step. A courtesy only:
// the import re-derives every one of these answers from the archive.

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const planRequestSchema = z
  .object({
    issues: z
      .array(
        z
          .object({ id: idSchema, title: z.string().max(ISSUE_TITLE_MAX) })
          .strict(),
      )
      .min(1)
      .max(MAX_BUNDLE_ISSUES),
    sponsors: z
      .array(z.object({ id: idSchema, name: z.string().max(300) }).strict())
      .max(MAX_BUNDLE_ENTRIES),
    logos: z
      .array(z.object({ id: idSchema, name: z.string().max(300) }).strict())
      .max(MAX_BUNDLE_ENTRIES),
  })
  .strict();

export type PlanRequest = z.infer<typeof planRequestSchema>;

export type LibraryPlan = {
  id: string;
  name: string;
  outcome: "reuse" | "create" | "ambiguous";
};

export type IssuePlan = {
  id: string;
  title: string;
  titleExists: boolean;
};

export type ImportPlan = {
  issues: IssuePlan[];
  sponsors: LibraryPlan[];
  logos: LibraryPlan[];
};
