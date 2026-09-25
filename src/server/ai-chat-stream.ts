import "server-only";
import {
  convertToModelMessages,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_PROJECTION_END,
  AI_PROJECTION_PART,
  type AiProjectionData,
} from "@/lib/ai-chat-contract";
import { assistantTools } from "@/server/ai-chat-tools";
import { aiError, classifyProviderError } from "@/server/ai-errors";
import { systemPrompt, type PromptFeatures } from "@/server/ai-prompt";
import type { AssistantModel } from "@/server/ai-provider";

// The model call behind the chat route (#308), apart from its gates and
// metering so the model-selection fixture (#315) runs exactly this in-process.
// Everything that shapes what the provider sees and caches lives here.

// The default 5-minute TTL: ai-pricing bills cache writes at that rate, so
// never "1h" here.
const cached = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/** A cache breakpoint on the newest message, so the next request reads the
 *  whole conversation so far from the cache. */
function withTailBreakpoint(messages: ModelMessage[]): ModelMessage[] {
  const last = messages[messages.length - 1];
  if (!last) return messages;
  return [...messages.slice(0, -1), { ...last, providerOptions: cached }];
}

/** The panel's messages as the model reads them: the projection as text, and
 *  a call the author stopped mid-way (no result) left out. Throws on a
 *  message the SDK can't convert. */
export function toModelMessages(
  messages: UIMessage[],
): Promise<ModelMessage[]> {
  return convertToModelMessages(messages, {
    tools: assistantTools,
    ignoreIncompleteToolCalls: true,
    convertDataPart: (part) =>
      part.type === AI_PROJECTION_PART
        ? {
            type: "text",
            text: `${(part.data as AiProjectionData).text}\n\n${AI_PROJECTION_END}`,
          }
        : undefined,
  });
}

export type StreamHooks = {
  onChunk?: (chunk: { type: string; text?: string; delta?: string }) => void;
  onEnd?: (
    usage: LanguageModelUsage,
    modelId: string | undefined,
  ) => void | Promise<void>;
  onAbort?: () => void | Promise<void>;
  onError?: () => void | Promise<void>;
};

/** The reply as the UI message stream the panel reads; failures arrive as
 *  its error text, `{ error, code }` JSON. */
export function streamAssistant({
  config,
  messages,
  features,
  abortSignal,
  hooks = {},
}: {
  config: AssistantModel;
  messages: ModelMessage[];
  features?: PromptFeatures;
  abortSignal?: AbortSignal;
  hooks?: StreamHooks;
}): ReadableStream<UIMessageChunk> {
  const result = streamText({
    model: config.model,
    // Byte-stable, with a breakpoint: the tools and prompt are cached once.
    instructions: {
      role: "system",
      content: systemPrompt(features),
      providerOptions: cached,
    },
    messages: withTailBreakpoint(messages),
    tools: assistantTools,
    reasoning: config.reasoning,
    providerOptions: config.providerOptions,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal,
    onChunk: ({ chunk }) => hooks.onChunk?.(chunk),
    onEnd: (event) =>
      hooks.onEnd?.(event.usage, event.finalStep?.response.modelId),
    onAbort: () => hooks.onAbort?.(),
    onError: () => hooks.onError?.(),
  });
  return toUIMessageStream({
    stream: result.stream,
    sendReasoning: true,
    onError: (error) => {
      const code = classifyProviderError(error);
      if (code === "provider_down") console.error("AI chat failed", error);
      return JSON.stringify(aiError(code));
    },
  });
}
