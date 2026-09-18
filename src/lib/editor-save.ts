import { z } from "zod";

// The save route's whole-request cap (it matches the Server Action body limit
// the route replaced). Shared, because anything that creates a document has to
// leave it savable — see the issue-transfer limits.
export const SAVE_REQUEST_MAX_BYTES = 1024 * 1024;

export const ISSUE_TITLE_MAX = 200;

// Keep these responses compatible with already-open editors across releases.
export const contentSaveResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), revision: z.number().int().min(0) }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["invalid", "conflict", "missing"]),
  }),
]);

export const metaSaveResultSchema = z.object({ ok: z.boolean() });
export type SaveResult = z.infer<typeof contentSaveResultSchema>;
