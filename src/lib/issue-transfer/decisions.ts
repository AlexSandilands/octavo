import { z } from "zod";
import { MAX_BUNDLE_ISSUES } from "./limits";

// What the admin chose in the Review step, travelling beside the zip in one
// bounded header. A discriminated union so replacing an existing issue (#294)
// adds a member rather than reshaping anything.

export const IMPORT_DECISIONS_HEADER = "x-issue-import";

export const importDecisionSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("new"),
      issueId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    })
    .strict(),
]);

export type ImportDecision = z.infer<typeof importDecisionSchema>;

export const importRequestSchema = z
  .object({
    // Minted by the modal when the admin confirms, so a retry after a lost
    // response is told apart from importing the same file a second time.
    operationId: z.string().uuid(),
    decisions: z.array(importDecisionSchema).min(1).max(MAX_BUNDLE_ISSUES),
  })
  .strict();

export type ImportRequest = z.infer<typeof importRequestSchema>;
