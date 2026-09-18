import { z } from "zod";
import { MAX_BUNDLE_ENTRIES, MAX_BUNDLE_ISSUES } from "./limits";

// The write-free look-ahead behind the modal's Review step. It is handed the
// manifest's titles and library names — never the archive — and answers what an
// import would do with them. A courtesy only: the import request re-derives and
// re-checks every one of these answers server-side.

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const planRequestSchema = z
  .object({
    issues: z
      .array(z.object({ id: idSchema, title: z.string().max(200) }).strict())
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
  /** Whether the archive already holds an issue with this title, so the review
   *  step can say a second copy is about to appear rather than surprise anyone. */
  titleExists: boolean;
};

export type ImportPlan = {
  issues: IssuePlan[];
  sponsors: LibraryPlan[];
  logos: LibraryPlan[];
};
