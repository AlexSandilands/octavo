import { z } from "zod";

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
