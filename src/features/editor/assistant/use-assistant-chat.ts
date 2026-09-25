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
  AI_MAX_MESSAGES,
  AI_MAX_TEXT_CHARS,
  AI_PROJECTION_PART,
  readAiError,
  type AiError,
  type AiProjectionData,
} from "@/lib/ai-chat-contract";
import type { AiToolInput, AiToolOutput } from "@/lib/ai-tools";
import type { AssistantIssue } from "./issue-context";
import { projection } from "./projection";
import { runAssistantTool } from "./tools";

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
  {
    read_page: {
      input: AiToolInput<"read_page">;
      output: AiToolOutput;
    };
  }
>;

/** The issue as it stands, with every page's fill measured, and the page open now. */
export type AssistantSnapshot = () => Promise<{
  issue: AssistantIssue;
  currentPage: number;
}>;

/** Room for one more run: the author's message and the reply to it. */
const RUN_MESSAGES = 2;

export function useAssistantChat({
  issueId,
  snapshot,
  onRunEnd,
}: {
  issueId: string;
  snapshot: AssistantSnapshot;
  /** A run finished, stopped or failed: its spend is on the ledger now. */
  onRunEnd: () => void;
}) {
  const runId = useRef("");
  const stopped = useRef(false);
  const runOpen = useRef(false);
  // The Chat is made once; its callbacks read the latest props through these.
  const latest = useRef({ snapshot, onRunEnd });
  useEffect(() => {
    latest.current = { snapshot, onRunEnd };
  });
  const [running, setRunning] = useState(false);
  const [full, setFull] = useState(false);

  // Idempotent: a failed stream reports through both onError and onFinish.
  const endRun = () => {
    setRunning(false);
    if (!runOpen.current) return;
    runOpen.current = false;
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
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: runAssistantTool(toolCall.toolName, toolCall.input, issue),
        });
      } catch (error) {
        chat.addToolOutput({
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: error instanceof Error ? error.message : "Tool failed",
        });
      }
    },
    onFinish: ({ message, isAbort, isError }) => {
      const awaitingTool = message.parts.some(
        (p) =>
          p.type.startsWith("tool-") &&
          "state" in p &&
          p.state === "input-available",
      );
      if (isAbort || isError || stopped.current || !awaitingTool) endRun();
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
    const text = request.trim().slice(0, AI_MAX_TEXT_CHARS);
    if (!text || busy || full) return;
    if (chat.messages.length + RUN_MESSAGES > AI_MAX_MESSAGES) {
      setFull(true);
      return;
    }
    runId.current = crypto.randomUUID();
    stopped.current = false;
    runOpen.current = true;
    setRunning(true);
    try {
      const { issue, currentPage } = await latest.current.snapshot();
      await chat.sendMessage({
        parts: [
          {
            type: AI_PROJECTION_PART,
            data: { text: projection(issue, currentPage) },
          },
          { type: "text", text },
        ],
      });
    } catch {
      // useChat reports request failures through `error` and onError.
      endRun();
    }
  };

  const stop = () => {
    stopped.current = true;
    void chat.stop();
    endRun();
  };

  /** The route's message cap reached: a fresh conversation, nothing trimmed. */
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
    send,
    stop,
    restart,
  };
}
