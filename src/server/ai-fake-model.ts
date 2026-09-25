import "server-only";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

// AI_PROVIDER=fake (#308): canned, deterministic replies for gates and the
// demo, costing $0 (priced as "fake" in ai-pricing). An author message gets a
// sentence echoing the projection's first line, then a read_page(1) call; a
// tool result gets a closing sentence naming what came back. "[fake:fail]" in
// the author's message fails the request before it streams, "[fake:drop]"
// fails it midway, so gates can reach the failure copy; "[fake:slow]" takes
// its time.

export const FAKE_TRIGGER_FAIL = "[fake:fail]";
export const FAKE_TRIGGER_DROP = "[fake:drop]";
// Spaces the stream out (a second a part), so a gate can hang up mid-reply.
export const FAKE_TRIGGER_SLOW = "[fake:slow]";

type Reply = { text: string; toolCall?: { toolName: string; input: object } };

function textOf(parts: { type: string; text?: string }[]): string[] {
  return parts.flatMap((p) => (p.type === "text" && p.text ? [p.text] : []));
}

/** The reply for a prompt; exported so gates can assert the exact wording. */
export function fakeReply(prompt: LanguageModelV4Prompt): Reply {
  const last = prompt[prompt.length - 1];
  if (last?.role === "tool") {
    const result = last.content.find((p) => p.type === "tool-result");
    const output = result?.type === "tool-result" ? result.output : undefined;
    const chars =
      output?.type === "text"
        ? output.value.length
        : output?.type === "content"
          ? output.value.reduce(
              (n, p) => n + (p.type === "text" ? p.text.length : 0),
              0,
            )
          : JSON.stringify(output ?? "").length;
    return {
      text: `Read ${result?.toolName ?? "nothing"} (${chars} characters back). Nothing needed changing.`,
    };
  }
  if (last?.role !== "user") return { text: "There was nothing to answer." };
  const [projection, ...rest] = textOf(last.content);
  if (rest.length === 0)
    return { text: "I can't see the issue, so I haven't changed anything." };
  const firstLine = projection!.split("\n", 1)[0]!.trim();
  return {
    text: `Looking at "${firstLine}".`,
    toolCall: { toolName: "read_page", input: { page: 1 } },
  };
}

const chars = (prompt: LanguageModelV4Prompt) => JSON.stringify(prompt).length;

function usage(input: number, output: number): LanguageModelV4Usage {
  const inputTokens = Math.ceil(input / 4);
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: {
      total: Math.ceil(output / 4),
      text: Math.ceil(output / 4),
      reasoning: 0,
    },
  };
}

function authorText(prompt: LanguageModelV4Prompt): string {
  const last = prompt[prompt.length - 1];
  return last?.role === "user" ? textOf(last.content).join("\n") : "";
}

export function createFakeModel(): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "fake",
    modelId: "fake",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("The fake model only streams.");
    },
    async doStream(options: LanguageModelV4CallOptions) {
      const said = authorText(options.prompt);
      if (said.includes(FAKE_TRIGGER_FAIL))
        throw new Error("The fake provider was asked to fail.");
      const reply = fakeReply(options.prompt);
      const slow = said.includes(FAKE_TRIGGER_SLOW);
      const parts: LanguageModelV4StreamPart[] = [
        { type: "stream-start", warnings: [] },
        { type: "response-metadata", id: "fake-response", modelId: "fake" },
        { type: "text-start", id: "t1" },
        // Two deltas, so the panel sees text arrive in pieces.
        ...reply.text
          .split(/(?<=\s)/)
          .reduce<string[]>(
            (acc, word, i) => {
              acc[i < 3 ? 0 : 1] += word;
              return acc;
            },
            ["", ""],
          )
          .filter(Boolean)
          .map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
        { type: "text-end", id: "t1" },
      ];
      if (said.includes(FAKE_TRIGGER_DROP)) {
        parts.push({
          type: "error",
          error: new Error("The fake provider dropped the stream."),
        });
      } else if (reply.toolCall) {
        parts.push({
          type: "tool-call",
          toolCallId: `fake-call-${options.prompt.length}`,
          toolName: reply.toolCall.toolName,
          input: JSON.stringify(reply.toolCall.input),
        });
      }
      parts.push({
        type: "finish",
        finishReason: {
          unified: reply.toolCall ? "tool-calls" : "stop",
          raw: undefined,
        },
        usage: usage(chars(options.prompt), reply.text.length),
      });
      return {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          async pull(controller) {
            const part = parts.shift();
            if (!part) return controller.close();
            if (slow) await new Promise((r) => setTimeout(r, 1000));
            controller.enqueue(part);
          },
        }),
      };
    },
  };
}
