// The assistant's tool contract (#306): intent in, never block JSON. Shared by
// the chat route (which declares the tools and validates the model's arguments)
// and the editor's executor (which runs them), so both read the same zod.
// Lifted from the spike (`scripts/spike/assistant/tools.ts`); #310 adds the
// editing tools here.
import { z } from "zod";

const pageNo = z
  .number()
  .int()
  .min(1)
  .max(200)
  .describe("Page number, 1-based as in the outline.");

export const aiToolSchemas = {
  read_page: z.object({ page: pageNo }).strict(),
} as const;

export const aiToolDescriptions: Record<AiToolName, string> = {
  read_page:
    "Read one page in full: every block with its id, text as markdown, and how full the page is.",
};

export type AiToolName = keyof typeof aiToolSchemas;
export const AI_TOOL_NAMES = Object.keys(aiToolSchemas) as AiToolName[];
export type AiToolInput<N extends AiToolName> = z.infer<
  (typeof aiToolSchemas)[N]
>;

// What every tool returns to the model, from the browser via addToolOutput.
// Refusals and invalid arguments are ordinary outputs the model reads, never
// throws. `images` is for #342's view tools: base64 without a data: prefix.
export const AI_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const AI_MAX_IMAGE_BASE64 = 1_500_000;
export const AI_MAX_TOOL_TEXT = 60_000;
export const AI_MAX_IMAGES_PER_OUTPUT = 8;

export const aiToolOutputSchema = z
  .object({
    text: z.string().max(AI_MAX_TOOL_TEXT),
    images: z
      .array(
        z
          .object({
            mediaType: z.enum(AI_IMAGE_TYPES),
            data: z.string().min(1).max(AI_MAX_IMAGE_BASE64),
          })
          .strict(),
      )
      .max(AI_MAX_IMAGES_PER_OUTPUT)
      .optional(),
  })
  .strict();
export type AiToolOutput = z.infer<typeof aiToolOutputSchema>;
