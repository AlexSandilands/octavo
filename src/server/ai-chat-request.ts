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

// Each part mirrors its type in `ai` 7.0.114 (TextUIPart, ReasoningUIPart,
// FileUIPart, StepStartUIPart, the tool invocation states), optional fields
// included (bar a file's providerReference: images come as data: URLs only),
// so `.strict()` refuses only keys the SDK never writes. Recheck
// them when the SDK is upgraded: the stream processor adds fields the panel
// replays verbatim (a reasoning part's `id`, for one).
const meta = z.record(z.string(), z.unknown()).optional();
const dataUrl = new RegExp(
  `^data:(${AI_IMAGE_TYPES.join("|").replace(/\//g, "\\/")});base64,`,
);
const approval = z.record(z.string(), z.unknown()).optional();

const toolPartSchema = z
  .object({
    type: z.enum(
      AI_TOOL_NAMES.map((n) => `tool-${n}`) as [string, ...string[]],
    ),
    toolCallId: z.string().min(1).max(200),
    // Unanswered calls (streaming, available) are dropped before the model.
    state: z.enum([
      "input-streaming",
      "input-available",
      "approval-requested",
      "approval-responded",
      "output-available",
      "output-error",
      "output-denied",
    ]),
    input: z.unknown().optional(),
    rawInput: z.unknown().optional(),
    output: z.unknown().optional(),
    errorText: z.string().max(AI_MAX_TEXT_CHARS).optional(),
    providerExecuted: z.boolean().optional(),
    preliminary: z.boolean().optional(),
    callProviderMetadata: meta,
    resultProviderMetadata: meta,
    toolMetadata: meta,
    approval,
    title: z.string().max(200).optional(),
  })
  .strict();

const partSchema = z.union([
  z
    .object({
      type: z.literal("text"),
      // Not in TextUIPart today; accepted in case the stream starts adding it.
      id: z.string().max(200).optional(),
      text: z.string().max(AI_MAX_TEXT_CHARS),
      state: z.enum(["streaming", "done"]).optional(),
      providerMetadata: meta,
    })
    .strict(),
  // With thinking display omitted, text is empty and the signature rides in
  // providerMetadata.
  z
    .object({
      type: z.literal("reasoning"),
      id: z.string().max(200).optional(),
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

// Why a body was refused, for the server log only: paths and zod's messages,
// never the content. A union failure is reported from the branch whose `type`
// matched, which is the part the client meant to send.
function describeIssues(issues: z.ZodIssue[]): string[] {
  return issues.flatMap((issue) => {
    if (issue.code === z.ZodIssueCode.invalid_union) {
      const meant = issue.unionErrors.filter(
        (e) => !e.issues.some((i) => i.path.at(-1) === "type"),
      );
      if (meant.length) return meant.flatMap((e) => describeIssues(e.issues));
    }
    return [`${issue.path.join(".") || "(body)"}: ${issue.message}`];
  });
}

function logRefusal(reasons: string[]) {
  console.debug(`AI chat body refused: ${reasons.slice(0, 5).join("; ")}`);
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
  if (!body.success) {
    logRefusal(describeIssues(body.error.issues));
    return { ok: false, reason: "bad_request" };
  }

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages<UIMessage>({
      messages: body.data.messages as UIMessage[],
      tools,
    });
  } catch (err) {
    logRefusal([err instanceof Error ? err.message : String(err)]);
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
