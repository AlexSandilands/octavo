import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { LanguageModelUsage } from "ai";
import { recordUsage } from "@/server/ai-budget";

// One ai_usage row per chat request (#308), whatever happens to the stream:
// the provider's reported tokens when the request ends normally, else an
// estimate from characters with the model marked "~". Never skipped.

type MeterInput = {
  userId: string;
  issueId: string;
  runId: string;
  provider: string;
  modelId: string;
  /** Characters sent to the model: prompt, tools and messages. */
  inputChars: number;
};

// A rough, deliberately generous characters-per-token for the estimate.
const CHARS_PER_TOKEN = 3;
const estimate = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

export function createMeter(input: MeterInput) {
  let outputChars = 0;
  let recorded = false;

  async function write(
    model: string,
    tokens: {
      promptTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      completionTokens: number;
    },
  ) {
    if (recorded) return;
    recorded = true;
    try {
      await recordUsage({
        userId: input.userId,
        issueId: input.issueId,
        runId: input.runId,
        provider: input.provider,
        model,
        ...tokens,
      });
    } catch (err) {
      // The request has happened; losing its row is a bug to hear about.
      console.error("Could not record AI usage", err);
      Sentry.captureException(err);
    }
  }

  /** No usage from the provider: estimate. `sent` is false when the request
   *  failed before the provider produced anything. */
  const writeEstimate = (sent: boolean) =>
    write(`${input.modelId}~`, {
      promptTokens: sent ? estimate(input.inputChars) : 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      completionTokens: estimate(outputChars),
    });

  return {
    /** Counts streamed output, for the estimate. */
    onChunk(chunk: { type: string; text?: string; delta?: string }) {
      outputChars += (chunk.text ?? chunk.delta ?? "").length;
    },
    async onEnd(usage: LanguageModelUsage, reportedModel: string | undefined) {
      if (usage.inputTokens === undefined) return writeEstimate(true);
      const details = usage.inputTokenDetails;
      const cacheRead = details.cacheReadTokens ?? 0;
      const cacheWrite = details.cacheWriteTokens ?? 0;
      await write(reportedModel || input.modelId, {
        promptTokens:
          details.noCacheTokens ??
          Math.max(0, usage.inputTokens - cacheRead - cacheWrite),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        completionTokens: usage.outputTokens ?? 0,
      });
    },
    onAbort: () => writeEstimate(true),
    onError: () => writeEstimate(outputChars > 0),
  };
}
