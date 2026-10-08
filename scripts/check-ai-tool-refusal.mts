// A tool call the SDK refuses before it runs (input off the schema, or no such
// tool) goes back to the model as the tool's error text, naming what to fix,
// not as the provider_down outage that made models give up. In-process on the
// route's own model call (streamAssistant). No database, no spend.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-tool-refusal.mts
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import type { UIMessageChunk } from "ai";

import { aiPlanSectionSchema } from "../src/lib/ai-tools.ts";
import { streamAssistant } from "../src/server/ai-chat-stream.ts";
import { createAssistantModel } from "../src/server/ai-provider.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};

const fake = createAssistantModel({ provider: "fake" });

/** A model that makes one tool call and stops. */
function calling(toolName: string, input: unknown): LanguageModelV4 {
  const parts: LanguageModelV4StreamPart[] = [
    {
      type: "tool-call",
      toolCallId: "call-1",
      toolName,
      input: JSON.stringify(input),
    },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
    },
  ];
  return {
    ...(fake.model as LanguageModelV4),
    async doStream() {
      return {
        stream: new ReadableStream({
          start(c) {
            for (const p of parts) c.enqueue(p);
            c.close();
          },
        }),
      };
    },
  };
}

async function errorText(toolName: string, input: unknown) {
  const stream = streamAssistant({
    config: { ...fake, model: calling(toolName, input) },
    messages: [{ role: "user", content: "Lay this out." }],
  });
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read())
    chunks.push(r.value);
  const refused = chunks.find((c) => c.type === "tool-output-error");
  return {
    text: refused && "errorText" in refused ? refused.errorText : undefined,
    streamError: chunks.some((c) => c.type === "error"),
  };
}

const section = {
  headline: "The great leek weigh-in",
  body: "Nine entrants.",
  photos: [{ imageId: "img-1", align: "right", width: 45 }],
};
ok(
  aiPlanSectionSchema.safeParse(section).success,
  "a plan's photo takes a width, as insert_blocks' does",
);

const bad = await errorText("propose_sections", {
  after: 2,
  sections: [{ ...section, photos: [{ imageId: "img-1", size: "big" }] }],
});
ok(!bad.streamError, "a refused call doesn't fail the reply");
ok(
  bad.text?.startsWith("The propose_sections call was refused") &&
    bad.text.includes("sections.0.photos.0") &&
    bad.text.includes("'size'") &&
    !bad.text.includes("provider_down"),
  `the model reads what to fix (${bad.text})`,
);

const missing = await errorText("make_coffee", {});
ok(
  missing.text?.includes('no tool called "make_coffee"'),
  `an unknown tool is named (${missing.text})`,
);

console.log("\nPASS — refused tool calls go back to the model");
