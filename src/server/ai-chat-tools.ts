import "server-only";
import { tool } from "ai";
import {
  AI_TOOL_NAMES,
  aiToolDescriptions,
  aiToolOutputSchema,
  aiToolSchemas,
  type AiToolOutput,
} from "@/lib/ai-tools";

// The tools as the route declares them (#308): schemas only, no `execute`, so
// every call streams to the editor, which runs it and sends the result back.
// Built in a fixed order from the shared contract, so the tool list the model
// sees is byte-stable and stays inside the prompt cache.

/** An editor's output as the model reads it: text, then any images, as
 *  content inside the tool result. */
export function toModelOutput(output: AiToolOutput) {
  if (!output.images?.length)
    return { type: "text" as const, value: output.text };
  return {
    type: "content" as const,
    value: [
      { type: "text" as const, text: output.text },
      ...output.images.map((image) => ({
        type: "file" as const,
        mediaType: image.mediaType,
        data: { type: "data" as const, data: image.data },
      })),
    ],
  };
}

function buildTools() {
  return Object.fromEntries(
    AI_TOOL_NAMES.map((name) => [
      name,
      tool({
        description: aiToolDescriptions[name],
        inputSchema: aiToolSchemas[name],
        outputSchema: aiToolOutputSchema,
        toModelOutput: ({ output }) => toModelOutput(output),
      }),
    ]),
  );
}

export type AssistantToolSet = ReturnType<typeof buildTools>;
export const assistantTools: AssistantToolSet = buildTools();
