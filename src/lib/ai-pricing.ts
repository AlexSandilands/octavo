// List prices per million tokens for every model the assistant may run
// (issue #307). A model missing here can't be metered, so recordUsage refuses
// it rather than log the request at $0. Cache writes are the 5-minute rate —
// the proxy uses the default cache TTL. Check `checked` against
// https://platform.claude.com/docs/en/about-claude/pricing before relying on it.
export type ModelPrice = {
  inputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWritePerMillion: number;
  outputPerMillion: number;
  checked: string;
};

export const AI_PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-sonnet-5": {
    inputPerMillion: 2,
    cacheReadPerMillion: 0.2,
    cacheWritePerMillion: 2.5,
    outputPerMillion: 10,
    checked: "2026-09-25",
  },
  "claude-haiku-4-5": {
    inputPerMillion: 1,
    cacheReadPerMillion: 0.1,
    cacheWritePerMillion: 1.25,
    outputPerMillion: 5,
    checked: "2026-09-25",
  },
  // AI_PROVIDER=fake (gates, the demo, fixtures): real rows at no cost.
  fake: {
    inputPerMillion: 0,
    cacheReadPerMillion: 0,
    cacheWritePerMillion: 0,
    outputPerMillion: 0,
    checked: "2026-09-25",
  },
};

// A run is refused further requests once its spend passes this
// (docs/ai-assistant.md → Runs).
export const RUN_SPEND_CAP_USD = 0.5;

export type TokenCounts = {
  promptTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  completionTokens: number;
};

// The price for a model id as the provider reports it: the exact key, else the
// longest key it extends by a date snapshot (`claude-haiku-4-5-20251001`). Any
// other suffix is a different model and gets no price. A trailing `~` marks
// tokens the proxy estimated, priced as the model itself.
export function priceFor(reported: string): ModelPrice | undefined {
  const model = reported.endsWith("~") ? reported.slice(0, -1) : reported;
  return modelEntry(AI_PRICES, model);
}

/** A per-model table's entry: the exact key, else the longest key the id
 *  extends by a date snapshot. */
export function modelEntry<T>(
  table: Readonly<Record<string, T>>,
  model: string,
): T | undefined {
  if (Object.hasOwn(table, model)) return table[model];
  const key = Object.keys(table)
    .filter(
      (k) =>
        model.startsWith(`${k}-`) && /^\d{8}$/.test(model.slice(k.length + 1)),
    )
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : undefined;
}

// The request's cost in USD, rounded to the ledger's six places. Price per
// million tokens is micro-dollars per token, so the sum is in micro-dollars.
export function priceUsage(model: string, tokens: TokenCounts): number {
  const price = priceFor(model);
  if (!price) throw new Error(`No price for AI model "${model}".`);
  const micros =
    tokens.promptTokens * price.inputPerMillion +
    tokens.cacheReadTokens * price.cacheReadPerMillion +
    tokens.cacheWriteTokens * price.cacheWritePerMillion +
    tokens.completionTokens * price.outputPerMillion;
  return Math.round(micros) / 1_000_000;
}
