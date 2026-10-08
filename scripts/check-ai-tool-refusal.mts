// A tool call whose input the SDK refuses before it runs goes back to the
// model as the tool's error text, naming what to fix, not as the
// provider_down outage that made models give up. In-process on the route's
// own model call (streamAssistant), streamed as Anthropic streams a call,
// then through the panel's resend: the route's body check and the
// conversion the model reads. No database, no spend.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-tool-refusal.mts
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { readUIMessageStream, type UIMessage } from "ai";

import { aiPlanSectionSchema } from "../src/lib/ai-tools.ts";
import { parseChatBody } from "../src/server/ai-chat-request.ts";
import {
  streamAssistant,
  toModelMessages,
} from "../src/server/ai-chat-stream.ts";
import { assistantTools } from "../src/server/ai-chat-tools.ts";
import { createAssistantModel } from "../src/server/ai-provider.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};

const fake = createAssistantModel({ provider: "fake" });

/** A model that makes one tool call, streamed in Anthropic's shape, and stops. */
function calling(toolName: string, input: unknown): LanguageModelV4 {
  const json = JSON.stringify(input);
  const id = "call-1";
  const parts: LanguageModelV4StreamPart[] = [
    { type: "tool-input-start", id, toolName },
    { type: "tool-input-delta", id, delta: json },
    { type: "tool-input-end", id },
    { type: "tool-call", toolCallId: id, toolName, input: json },
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

const author: UIMessage = {
  id: "author",
  role: "user",
  parts: [{ type: "text", text: "Lay this out." }],
};

/** The reply's tool part, and what the model reads of it on the next request. */
async function roundTrip(toolName: string, input: unknown) {
  const stream = streamAssistant({
    config: { ...fake, model: calling(toolName, input) },
    messages: [{ role: "user", content: "Lay this out." }],
  });
  let reply: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream })) reply = m;
  const part = reply?.parts.find((p) => p.type.startsWith("tool-"));
  const body = await parseChatBody(
    {
      runId: crypto.randomUUID(),
      issueId: crypto.randomUUID(),
      messages: [author, reply],
    },
    assistantTools,
  );
  const sent = body.ok ? await toModelMessages(body.chat.messages) : [];
  return {
    part,
    accepted: body.ok,
    read: JSON.stringify(sent.filter((m) => m.role === "tool")),
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

const bad = await roundTrip("propose_sections", {
  after: 2,
  sections: [{ ...section, photos: [{ imageId: "img-1", size: "big" }] }],
});
const text =
  bad.part && "errorText" in bad.part ? (bad.part.errorText ?? "") : "";
ok(
  bad.part?.type === "tool-propose_sections" &&
    text.startsWith("The propose_sections call was refused") &&
    text.includes("sections.0.photos.0") &&
    text.includes("'size'") &&
    !text.includes("provider_down"),
  `the reply's tool part says what to fix (${text})`,
);
ok(
  bad.accepted && bad.read.includes("sections.0.photos.0"),
  "the panel's resend passes the route's body check, and the model reads the error",
);

console.log("\nPASS — a refused tool call goes back to the model");
