"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  AI_CHAT_PATH,
  AI_MAX_CONVERSATION_CHARS,
  AI_MAX_MESSAGES,
  AI_MAX_TEXT_CHARS,
  AI_PROJECTION_PART,
  readAiError,
  type AiError,
  type AiProjectionData,
} from "@/lib/ai-chat-contract";
import type { AiToolInput, AiToolName, AiToolOutput } from "@/lib/ai-tools";
import type { RunSummary } from "./executor";
import type { AssistantIssue } from "./issue-context";
import { projection } from "./projection";
import type { AssistantTools } from "./tools";

// The assistant's conversation (#309): the only file that knows the AI SDK's
// client side — `useChat`, the transport and the stream's parts — so leaving the
// SDK means rewriting this and the route (docs/ai-assistant.md → Architecture).
//
// One author message and everything the model does in answer is a run, sent
// under one `runId`. The history is append-only (caching depends on it): never
// trimmed or edited, and at the route's message cap the conversation ends.

export type AssistantMessage = UIMessage<
  unknown,
  { projection: AiProjectionData },
  { [N in AiToolName]: { input: AiToolInput<N>; output: AiToolOutput } }
>;

/** The issue as it stands, with every page's fill measured, and the page open now. */
export type AssistantSnapshot = () => Promise<{
  issue: AssistantIssue;
  currentPage: number;
}>;

/** Room for one more run: the author's message and the reply to it… */
const RUN_MESSAGES = 2;
/** …and the characters that reply and its tool results may add. */
const RUN_CHARS = 20_000;

/** Characters the route counts against AI_MAX_CONVERSATION_CHARS (#308). */
function conversationChars(messages: AssistantMessage[]): number {
  let chars = 0;
  for (const m of messages)
    for (const part of m.parts) {
      if (part.type === "text" || part.type === "reasoning")
        chars += part.text.length;
      else if (part.type === AI_PROJECTION_PART) chars += part.data.text.length;
      else if ("toolCallId" in part)
        chars +=
          JSON.stringify(part.input ?? null).length +
          ((part.output as AiToolOutput | undefined)?.text.length ?? 0) +
          (part.errorText?.length ?? 0);
    }
  return chars;
}

/**
 * A stopped reply can end mid tool call. That tail was never answered, so it is
 * closed off rather than replayed half-made: a call still arriving is dropped,
 * one that arrived unanswered is marked stopped. Earlier turns are untouched.
 */
function closeStoppedTail(messages: AssistantMessage[]): AssistantMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;
  const parts = last.parts.flatMap((part): AssistantMessage["parts"] => {
    if (!("toolCallId" in part)) return [part];
    if (part.state === "input-streaming") return [];
    if (part.state !== "input-available") return [part];
    return [
      { ...part, state: "output-error", errorText: "Stopped by the editor." },
    ];
  });
  return [...messages.slice(0, -1), { ...last, parts }];
}

export function useAssistantChat({
  issueId,
  snapshot,
  tools,
  onRunEnd,
}: {
  issueId: string;
  snapshot: AssistantSnapshot;
  /** Runs the model's tool calls against the editor (#310). */
  tools: AssistantTools;
  /** A run finished, stopped or failed: its spend is on the ledger now. */
  onRunEnd: () => void;
}) {
  const runId = useRef("");
  const stopped = useRef(false);
  const runOpen = useRef(false);
  // The Chat is made once; its callbacks read the latest props through these.
  const latest = useRef({ snapshot, tools, onRunEnd });
  useEffect(() => {
    latest.current = { snapshot, tools, onRunEnd };
  });
  const [running, setRunning] = useState(false);
  const [full, setFull] = useState(false);
  // What the last run changed, and why it was stopped if the breaker tripped.
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [stuck, setStuck] = useState<string | null>(null);

  // Idempotent: a failed stream reports through both onError and onFinish.
  const endRun = () => {
    setRunning(false);
    if (!runOpen.current) return;
    runOpen.current = false;
    setSummary(latest.current.tools.endRun());
    latest.current.onRunEnd();
  };

  const chat = useChat<AssistantMessage>({
    // The Chat calls these when it sends, never during render.
    // eslint-disable-next-line react-hooks/refs
    transport: new DefaultChatTransport({
      api: AI_CHAT_PATH,
      body: () => ({ runId: runId.current, issueId }),
    }),
    // Tool results go straight back, same run — unless the author pressed Stop.
    sendAutomaticallyWhen: (options) =>
      !stopped.current && lastAssistantMessageIsCompleteWithToolCalls(options),
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic) return;
      try {
        const { issue } = await latest.current.snapshot();
        const output = await latest.current.tools.run(
          toolCall.toolName,
          toolCall.input,
          issue,
        );
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output,
        });
        const breaker = latest.current.tools.breaker();
        if (breaker && !stopped.current) {
          setStuck(breaker);
          stop();
        }
      } catch (error) {
        chat.addToolOutput({
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: error instanceof Error ? error.message : "Tool failed",
        });
      }
    },
    // The run goes on while a tool call awaits its answer or has one to send.
    // A quick tool can answer before the stream finishes, so both count (#351).
    onFinish: ({ message, messages, isAbort, isError }) => {
      const continues =
        message.parts.some(
          (p) =>
            p.type.startsWith("tool-") &&
            "state" in p &&
            p.state === "input-available",
        ) || lastAssistantMessageIsCompleteWithToolCalls({ messages });
      if (isAbort || isError || stopped.current || !continues) endRun();
    },
    onError: (error) => {
      if (readAiError(error.message).code === "too_long") setFull(true);
      endRun();
    },
  });

  const error: AiError | null = chat.error
    ? readAiError(chat.error.message)
    : null;
  const busy =
    running || chat.status === "submitted" || chat.status === "streaming";

  const send = async (request: string) => {
    // The composer holds anything longer back; the route would refuse it.
    const text = request.trim();
    if (!text || text.length > AI_MAX_TEXT_CHARS || busy || full) return;
    if (chat.messages.length + RUN_MESSAGES > AI_MAX_MESSAGES) {
      setFull(true);
      return;
    }
    runId.current = crypto.randomUUID();
    stopped.current = false;
    runOpen.current = true;
    setRunning(true);
    setSummary(null);
    setStuck(null);
    // Before anything can end the run, so its summary is never the last run's.
    latest.current.tools.beginRun();
    try {
      const { issue, currentPage } = await latest.current.snapshot();
      const view = projection(issue, currentPage);
      const size = conversationChars(chat.messages) + view.length + text.length;
      if (size + RUN_CHARS > AI_MAX_CONVERSATION_CHARS) {
        setFull(true);
        endRun();
        return;
      }
      await chat.sendMessage({
        parts: [
          { type: AI_PROJECTION_PART, data: { text: view } },
          { type: "text", text },
        ],
      });
    } catch {
      // useChat reports request failures through `error` and onError.
      endRun();
    }
  };

  const stop = async () => {
    stopped.current = true;
    await chat.stop();
    chat.setMessages(closeStoppedTail);
    endRun();
  };

  /** A fresh conversation (the old one is full, or the author asked). */
  const restart = () => {
    if (busy) return;
    chat.setMessages([]);
    chat.clearError();
    setFull(false);
  };

  return {
    messages: chat.messages,
    streaming: chat.status === "streaming",
    busy,
    error,
    full,
    /** The last run's change ("Changed 3 blocks on pages 4–5"), for its Undo. */
    summary,
    /** The circuit-breaker's message, when it stopped the last run. */
    stuck,
    /** The run was undone: its line goes. */
    dismissRun: () => {
      setSummary(null);
      setStuck(null);
    },
    send,
    stop,
    restart,
  };
}
