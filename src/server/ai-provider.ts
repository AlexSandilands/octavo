import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { anthropicThinking } from "@/lib/ai-thinking";
import { AI_PROVIDERS, DEFAULT_ANTHROPIC_MODEL, env } from "@/lib/env";
import { createFakeModel } from "@/server/ai-fake-model";

// The model the assistant runs on, from env (#308); the model-selection
// fixture (#315) builds one from its flags instead. Thinking and effort are
// set explicitly for every provider rather than left to their defaults.

// Adaptive thinking at a moderate effort: the spike's runs were tuned on it.
const REASONING = "medium";
export type AssistantEffort = "low" | "medium" | "high";

export type AssistantModel = {
  provider: string;
  modelId: string;
  model: LanguageModel;
  reasoning: AssistantEffort;
  providerOptions: SharedV4ProviderOptions;
  /** Overrides the chat route's idle timeout (fake provider, gates only). */
  idleTimeoutMs?: number;
};

export type AssistantProvider = (typeof AI_PROVIDERS)[number];

/** The configured model, or null when the assistant is off. */
export function assistantModel(): AssistantModel | null {
  const provider = env.AI_PROVIDER;
  if (!provider) return null;
  const keys = {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    fake: undefined,
  };
  const model = createAssistantModel({
    provider,
    modelId: env.AI_MODEL,
    apiKey: keys[provider],
  });
  const idleTimeoutMs = provider === "fake" ? env.AI_IDLE_TIMEOUT_MS : null;
  return idleTimeoutMs ? { ...model, idleTimeoutMs } : model;
}

/** A provider's model with the assistant's settings. `modelId` is required
 *  except on anthropic (the default) and fake. */
export function createAssistantModel({
  provider,
  modelId,
  apiKey,
  effort = REASONING,
}: {
  provider: AssistantProvider;
  modelId?: string;
  apiKey?: string;
  /** The fixture's sweep varies it; the route always takes the default. */
  effort?: AssistantEffort;
}): AssistantModel {
  switch (provider) {
    case "anthropic": {
      const id = modelId ?? DEFAULT_ANTHROPIC_MODEL;
      return {
        provider,
        modelId: id,
        model: createAnthropic({ apiKey })(id),
        reasoning: effort,
        providerOptions: {
          anthropic: {
            ...anthropicOptions(id, effort),
            // Thinking blocks go back with the history, as the API requires on
            // a tool turn.
            sendReasoning: true,
          } satisfies AnthropicLanguageModelOptions,
        },
      };
    }
    case "openai": {
      const id = required(provider, modelId);
      return {
        provider,
        modelId: id,
        model: createOpenAI({ apiKey })(id),
        reasoning: effort,
        providerOptions: { openai: { reasoningEffort: effort } },
      };
    }
    case "openrouter": {
      const id = required(provider, modelId);
      return {
        provider,
        modelId: id,
        model: createOpenRouter({ apiKey })(id, {
          reasoning: { effort },
        }),
        reasoning: effort,
        providerOptions: {},
      };
    }
    case "fake":
      return {
        provider,
        modelId: "fake",
        model: createFakeModel(),
        reasoning: effort,
        providerOptions: {},
      };
  }
}

function required(provider: string, modelId: string | undefined): string {
  if (!modelId) throw new Error(`The ${provider} provider needs a model id.`);
  return modelId;
}

/** Adaptive thinking at the effort, or the model's fixed budget (ai-thinking). */
function anthropicOptions(modelId: string, effort: AssistantEffort) {
  const thinking = anthropicThinking(modelId) ?? { type: "adaptive" as const };
  return thinking.type === "adaptive"
    ? ({ thinking, effort } as const)
    : { thinking };
}
