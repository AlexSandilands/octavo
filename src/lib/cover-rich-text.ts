import { z } from "zod";
import { coverColorSchema, coverShadowSchema } from "./cover-appearance";
const emphasis = z.object({ type: z.enum(["bold", "italic", "underline"]) });
const paint = z.object({
  type: z.literal("coverPaint"),
  attrs: z.object({
    color: coverColorSchema.nullish(),
    shadow: coverShadowSchema.nullish(),
    shadowColor: coverColorSchema.nullish(),
    fontStyle: z.enum(["normal", "italic"]).nullish(),
  }),
});
export const coverRichDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z
      .array(
        z.object({
          type: z.literal("paragraph"),
          content: z
            .array(
              z.union([
                z.object({
                  type: z.literal("text"),
                  text: z.string().min(1).max(8000),
                  marks: z
                    .array(z.union([emphasis, paint]))
                    .max(4)
                    .optional(),
                }),
                z.object({ type: z.literal("hardBreak") }),
              ]),
            )
            .max(300)
            .optional(),
        }),
      )
      .max(40),
  })
  .refine((doc) => coverDocPlain(doc).length <= 8000, "Cover text is too long");
export type CoverRichDoc = z.infer<typeof coverRichDocSchema>;
export function coverDocPlain(doc: {
  content: { content?: { type: string; text?: string }[] }[];
}): string {
  return doc.content
    .map((p) =>
      (p.content ?? [])
        .map((n) => (n.type === "text" ? n.text : "\n"))
        .join(""),
    )
    .join("\n");
}
export function plainCoverDoc(text: string): CoverRichDoc {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text" as const, text: line }] } : {}),
    })),
  };
}
/** A plain-field edit or linked-heading rename always wins over stale formatting. */
export function coverDocFor(text: string, doc?: CoverRichDoc): CoverRichDoc {
  return doc && coverDocPlain(doc) === text ? doc : plainCoverDoc(text);
}
export const coverRichFieldsSchema = z
  .record(z.string().max(128), coverRichDocSchema)
  .refine(
    (fields) => Object.keys(fields).length <= 20,
    "Too many cover text fields",
  );
