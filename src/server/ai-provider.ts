import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { anthropicThinking } from "@/lib/ai-thinking";
import { DEFAULT_ANTHROPIC_MODEL, env } from "@/lib/env";
import { createFakeModel } from "@/server/ai-fake-model";

// The model the assistant runs on, from env (#308). Thinking and effort are
// set explicitly for every provider rather than left to their defaults.

// Adaptive thinking at a moderate effort: the spike's runs were tuned on it.
const REASONING = "medium";

export type AssistantModel = {
  provider: string;
  modelId: string;
  model: LanguageModel;
  reasoning: typeof REASONING;
  providerOptions: SharedV4ProviderOptions;
};

/** The configured model, or null when the assistant is off. */
export function assistantModel(): AssistantModel | null {
  const provider = env.AI_PROVIDER;
  switch (provider) {
    case undefined:
      return null;
    case "anthropic": {
      const modelId = env.AI_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      return {
        provider,
        modelId,
        model: anthropic(modelId),
        reasoning: REASONING,
        providerOptions: {
          anthropic: {
            ...anthropicOptions(modelId),
            // Thinking blocks go back with the history, as the API requires on
            // a tool turn.
            sendReasoning: true,
          } satisfies AnthropicLanguageModelOptions,
        },
      };
    }
    case "openai": {
      const modelId = env.AI_MODEL!;
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return {
        provider,
        modelId,
        model: openai(modelId),
        reasoning: REASONING,
        providerOptions: { openai: { reasoningEffort: REASONING } },
      };
    }
    case "openrouter": {
      const modelId = env.AI_MODEL!;
      const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
      return {
        provider,
        modelId,
        model: openrouter(modelId, { reasoning: { effort: REASONING } }),
        reasoning: REASONING,
        providerOptions: {},
      };
    }
    case "fake":
      return {
        provider,
        modelId: "fake",
        model: createFakeModel(),
        reasoning: REASONING,
        providerOptions: {},
      };
  }
}

/** Adaptive thinking at the effort, or the model's fixed budget (ai-thinking). */
function anthropicOptions(modelId: string) {
  const thinking = anthropicThinking(modelId) ?? { type: "adaptive" as const };
  return thinking.type === "adaptive"
    ? ({ thinking, effort: REASONING } as const)
    : { thinking };
}
