import { modelEntry } from "./ai-pricing";

// How each Anthropic model is asked to think (#315), keyed like the price table.
// Adaptive thinking at an effort is what the spike was tuned on; Haiku 4.5
// refuses it ("adaptive thinking is not supported on this model"), so it gets a
// fixed budget instead, and no effort. A model missing here never boots (env.ts).
export type AnthropicThinking =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens: number };

export const ANTHROPIC_THINKING: Readonly<Record<string, AnthropicThinking>> = {
  "claude-sonnet-5": { type: "adaptive" },
  "claude-haiku-4-5": { type: "enabled", budgetTokens: 4000 },
};

export const anthropicThinking = (model: string) =>
  modelEntry(ANTHROPIC_THINKING, model);
