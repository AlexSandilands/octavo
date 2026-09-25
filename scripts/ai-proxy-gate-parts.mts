// Parts of dev-ai-proxy-gate.mts (#308): the chat helpers it shares, and two
// of its sections, kept apart so each file stays readable.
import { readFileSync } from "node:fs";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

export type GateDeps = {
  /** POSTs as the gate's first admin, from the right origin. */
  post: (body: unknown) => Promise<Response>;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
  expectError: (res: Response, status: number, code: string) => Promise<void>;
  hello: () => { runId: string; issueId: string; messages: UIMessage[] };
  draftId: string;
  newRun: () => string;
  tag: string;
  logPath: string | undefined;
};

export const userMessage = (text: string, projection?: string): UIMessage => ({
  id: crypto.randomUUID(),
  role: "user",
  parts: [
    ...(projection
      ? [{ type: "data-projection" as const, data: { text: projection } }]
      : []),
    { type: "text", text },
  ],
});

/** The response's chunks, parsed from the SSE the way the transport does. */
export async function chunksOf(res: Response): Promise<UIMessageChunk[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as UIMessageChunk);
}

/** The assistant message useChat would build from those chunks, continuing
 *  `last` when it's the assistant's (a tool round trip). */
export async function assemble(chunks: UIMessageChunk[], last?: UIMessage) {
  let message: UIMessage | undefined;
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });
  for await (const m of readUIMessageStream({ stream, message: last }))
    message = m;
  return message!;
}

/** A refused body's content stays out of the server log. */
export async function checkLogLeak(d: GateDeps) {
  const { post, ok, heading, expectError, hello, tag, logPath } = d;
  heading("refusals keep content out of the log");
  // A tool output with a key the schema doesn't know: the SDK's error message
  // quotes the whole value, page text included.
  const marker = `PAGE-TEXT-MARKER-${tag}`;
  const leaky: UIMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [
      {
        type: "tool-read_page",
        toolCallId: "leak-1",
        state: "output-available",
        input: { page: 1 },
        output: { text: `${marker} a secret draft paragraph`, extra: true },
      },
    ],
  } as UIMessage;
  await expectError(
    await post({
      ...hello(),
      messages: [
        ...hello().messages,
        leaky,
        userMessage(`${marker} and more`, `${marker} in the projection`),
      ],
    }),
    400,
    "bad_request",
  );
  if (logPath) {
    await new Promise((r) => setTimeout(r, 500));
    const log = readFileSync(logPath, "utf8");
    ok(
      log.includes("AI chat body refused") && log.includes("read_page"),
      "the refusal is logged, naming the tool",
    );
    ok(!log.includes(marker), "…and none of the refused content is");
  } else console.log("  (no --log given: log content not checked)");
}

/** Replies recorded from a real provider come back through the schema. */
export async function checkRecordedReplies(d: GateDeps) {
  const { post, ok, heading, draftId, newRun } = d;
  heading("replaying real replies");
  // Assistant messages as a real provider's stream built them (recorded by
  // dev-ai-smoke.mts --record, words replaced): every key the SDK writes must
  // come back through the body schema.
  const recorded = JSON.parse(
    readFileSync("scripts/fixtures/ai-assistant-replies.json", "utf8"),
  ) as UIMessage[];
  const replay = await post({
    runId: newRun(),
    issueId: draftId,
    messages: [
      ...recorded.flatMap((reply) => [
        userMessage("Go on.", "projection"),
        reply,
      ]),
      userMessage("And now?", "projection"),
    ],
  });
  const replayed = await chunksOf(replay);
  ok(
    replay.status === 200 && !replayed.some((c) => c.type === "error"),
    `${recorded.length} recorded replies are accepted and answered (${replay.status})`,
  );
}
