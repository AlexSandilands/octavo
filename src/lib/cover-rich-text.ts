import { z } from "zod";
import { coverFontSchema, coverWeightSchema, clampWeight } from "./cover-fonts";
import { coverColorSchema, coverShadowSchema } from "./cover-appearance";
const emphasis = z.object({ type: z.enum(["bold", "italic", "underline"]) });
const paint = z.object({
  type: z.literal("coverPaint"),
  attrs: z
    .object({
      color: coverColorSchema.nullish(),
      shadow: coverShadowSchema.nullish(),
      shadowColor: coverColorSchema.nullish(),
      fontStyle: z.enum(["normal", "italic"]).nullish(),
      fontFamily: coverFontSchema.nullish(),
      fontWeight: coverWeightSchema.nullish(),
    })
    .refine(
      (a) =>
        !a.fontFamily ||
        !a.fontWeight ||
        clampWeight(a.fontFamily, a.fontWeight) === a.fontWeight,
      "Weight is not supported by this font",
    ),
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

type PaintAttrs = z.infer<typeof paint>["attrs"];
const paintsOf = (doc: CoverRichDoc): PaintAttrs[] =>
  doc.content.flatMap((p) =>
    (p.content ?? []).flatMap((n) =>
      n.type === "text"
        ? (n.marks ?? []).flatMap((m) =>
            m.type === "coverPaint" ? [m.attrs] : [],
          )
        : [],
    ),
  );

/** New words in the typeface the old ones were set in (the inspector's choice);
 *  other per-word paint doesn't carry. Undefined when there's no face to keep. */
export function carryLettering(
  text: string,
  old?: CoverRichDoc,
): CoverRichDoc | undefined {
  const face = old && paintsOf(old).find((a) => a.fontFamily || a.fontWeight);
  if (!face || !text) return undefined;
  const attrs = {
    ...(face.fontFamily ? { fontFamily: face.fontFamily } : {}),
    ...(face.fontWeight ? { fontWeight: face.fontWeight } : {}),
  };
  const doc = plainCoverDoc(text);
  return {
    ...doc,
    content: doc.content.map((p) => ({
      ...p,
      ...(p.content && {
        content: p.content.map((n) => ({
          ...n,
          marks: [{ type: "coverPaint" as const, attrs }],
        })),
      }),
    })),
  };
}

/** Whether any words in these fields carry their own colour. */
export const hasWordColour = (fields?: Record<string, CoverRichDoc>) =>
  Object.values(fields ?? {}).some((doc) => paintsOf(doc).some((a) => a.color));
