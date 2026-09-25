import "server-only";
import { validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  AI_MAX_CONVERSATION_CHARS,
  AI_MAX_IMAGES_PER_MESSAGE,
  AI_MAX_IMAGES_PER_REQUEST,
  AI_MAX_MESSAGES,
  AI_MAX_PROJECTION_CHARS,
  AI_MAX_TEXT_CHARS,
  AI_PROJECTION_PART,
} from "@/lib/ai-chat-contract";
import {
  AI_IMAGE_TYPES,
  AI_MAX_IMAGE_BASE64,
  AI_TOOL_NAMES,
  type AiToolOutput,
} from "@/lib/ai-tools";
import type { AssistantToolSet } from "@/server/ai-chat-tools";

// The chat route's body (#308): shape and size, checked before anything is
// sent to the provider. Tool inputs and outputs are then checked against the
// tools' own zod by the SDK's validateUIMessages.

const meta = z.record(z.string(), z.unknown()).optional();
const dataUrl = new RegExp(
  `^data:(${AI_IMAGE_TYPES.join("|").replace(/\//g, "\\/")});base64,`,
);

const toolPartSchema = z
  .object({
    type: z.enum(
      AI_TOOL_NAMES.map((n) => `tool-${n}`) as [string, ...string[]],
    ),
    toolCallId: z.string().min(1).max(200),
    state: z.enum(["input-available", "output-available", "output-error"]),
    input: z.unknown(),
    output: z.unknown().optional(),
    errorText: z.string().max(AI_MAX_TEXT_CHARS).optional(),
    providerExecuted: z.boolean().optional(),
    callProviderMetadata: meta,
    resultProviderMetadata: meta,
    title: z.string().max(200).optional(),
  })
  .strict();

const partSchema = z.union([
  z
    .object({
      type: z.literal("text"),
      text: z.string().max(AI_MAX_TEXT_CHARS),
      state: z.enum(["streaming", "done"]).optional(),
      providerMetadata: meta,
    })
    .strict(),
  z
    .object({
      type: z.literal("reasoning"),
      text: z.string().max(AI_MAX_PROJECTION_CHARS),
      state: z.enum(["streaming", "done"]).optional(),
      providerMetadata: meta,
    })
    .strict(),
  z.object({ type: z.literal("step-start") }).strict(),
  z
    .object({
      type: z.literal(AI_PROJECTION_PART),
      id: z.string().max(100).optional(),
      data: z
        .object({ text: z.string().min(1).max(AI_MAX_PROJECTION_CHARS) })
        .strict(),
    })
    .strict(),
  // Page images for the end-of-run review (#342); never a remote URL.
  z
    .object({
      type: z.literal("file"),
      mediaType: z.enum(AI_IMAGE_TYPES),
      url: z
        .string()
        .max(AI_MAX_IMAGE_BASE64 + 40)
        .regex(dataUrl),
      filename: z.string().max(200).optional(),
      providerMetadata: meta,
    })
    .strict(),
  toolPartSchema,
]);

const messageSchema = z
  .object({
    id: z.string().max(200),
    role: z.enum(["user", "assistant"]),
    metadata: z.unknown().optional(),
    parts: z.array(partSchema).max(400),
  })
  .strict();

export const chatBodySchema = z.object({
  runId: z.string().uuid(),
  issueId: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1),
});

export type ChatRequest = {
  runId: string;
  issueId: string;
  messages: UIMessage[];
};

export type ParsedChat =
  | { ok: true; chat: ChatRequest }
  | { ok: false; reason: "bad_request" | "too_long" };

type Part = z.infer<typeof partSchema>;

/** Characters the model reads from a part, and images it carries. */
function measure(part: Part): { chars: number; images: number } {
  if ("toolCallId" in part) {
    const output = part.output as AiToolOutput | undefined;
    return {
      chars:
        JSON.stringify(part.input ?? null).length +
        (output?.text.length ?? 0) +
        (part.errorText?.length ?? 0),
      images: output?.images?.length ?? 0,
    };
  }
  switch (part.type) {
    case "text":
    case "reasoning":
      return { chars: part.text.length, images: 0 };
    case AI_PROJECTION_PART:
      return { chars: part.data.text.length, images: 0 };
    case "file":
      return { chars: 0, images: 1 };
    case "step-start":
      return { chars: 0, images: 0 };
  }
}

export async function parseChatBody(
  raw: unknown,
  tools: AssistantToolSet,
): Promise<ParsedChat> {
  // The message cap is its own answer: the panel ends the conversation there.
  const count = z.object({ messages: z.array(z.unknown()) }).safeParse(raw);
  if (count.success && count.data.messages.length > AI_MAX_MESSAGES)
    return { ok: false, reason: "too_long" };

  const body = chatBodySchema.safeParse(raw);
  if (!body.success) return { ok: false, reason: "bad_request" };

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages<UIMessage>({
      messages: body.data.messages as UIMessage[],
      tools,
    });
  } catch {
    return { ok: false, reason: "bad_request" };
  }

  let chars = 0;
  let images = 0;
  for (const message of body.data.messages) {
    let files = 0;
    for (const part of message.parts) {
      const m = measure(part);
      chars += m.chars;
      images += m.images;
      if (part.type === "file") files += 1;
    }
    // Tool outputs are capped per output by aiToolOutputSchema.
    if (files > AI_MAX_IMAGES_PER_MESSAGE)
      return { ok: false, reason: "bad_request" };
  }
  if (images > AI_MAX_IMAGES_PER_REQUEST || chars > AI_MAX_CONVERSATION_CHARS)
    return { ok: false, reason: "too_long" };

  const { runId, issueId } = body.data;
  return { ok: true, chat: { runId, issueId, messages } };
}
