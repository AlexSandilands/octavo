import { z } from "zod";
import { MAX_BUNDLE_ISSUES } from "./limits";

// What the admin chose in the Review step, travelling beside the zip in one
// bounded request header (the body is the archive itself). Every field is
// re-checked server-side — the client's plan is a courtesy.
//
// A discriminated union on `mode` with one member today: creating a new draft
// is the only outcome an import has. Deliberately replacing an existing issue
// adds a second member here and nothing else changes shape.

/** The header the decisions travel in, beside an `application/zip` body. */
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
    /** Minted by the modal when the admin confirms, so a retry after a lost
     *  response is told apart from importing the same file a second time. */
    operationId: z.string().uuid(),
    decisions: z.array(importDecisionSchema).min(1).max(MAX_BUNDLE_ISSUES),
  })
  .strict();

export type ImportRequest = z.infer<typeof importRequestSchema>;
