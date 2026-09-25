"use client";

import { useEffect, useRef } from "react";
import type { AiError } from "@/lib/ai-chat-contract";
import { ReplyText } from "./reply-text";
import type { AssistantMessage } from "./use-assistant-chat";

type Part = AssistantMessage["parts"][number];

/** A tool call as one quiet line in the thread: what the assistant looked at. */
function toolLine(part: Part): string | null {
  if (part.type !== "tool-read_page") return null;
  const page = part.input?.page;
  if (part.state === "output-error") return `Couldn’t read page ${page}`;
  return part.state === "output-available"
    ? `Read page ${page}`
    : `Reading page ${page ?? ""}…`;
}

function Message({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    // The projection rides in a data part the author never sees.
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    return (
      <div className="bg-accent-wash text-ink self-end rounded-xl rounded-br-sm px-3.5 py-2.5 font-sans text-[15px] leading-snug whitespace-pre-wrap">
        <span className="sr-only">You: </span>
        {text}
      </div>
    );
  }
  return (
    <div className="text-ink flex flex-col gap-2 font-serif text-[16px] leading-relaxed">
      <span className="sr-only">Assistant: </span>
      {message.parts.map((part, i) => {
        if (part.type === "text")
          return part.text.trim() ? (
            <ReplyText key={i} text={part.text} />
          ) : null;
        const line = toolLine(part);
        return line ? (
          <p key={i} className="text-faint font-sans text-[13px]">
            {line}
          </p>
        ) : null;
      })}
    </div>
  );
}

// The conversation, oldest first. A `role="log"` region: busy while a reply
// streams, so assistive tech announces the finished reply once rather than
// every word as it arrives. Errors from the route show inline, in its words.
export function AssistantThread({
  messages,
  busy,
  error,
  intro,
}: {
  messages: AssistantMessage[];
  busy: boolean;
  error: AiError | null;
  intro: string;
}) {
  const log = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const tail = last ? JSON.stringify(last.parts).length : 0;
  // Follow the newest words, as a chat does. Not scrollIntoView: that would
  // also scroll the panel's clipped ancestors.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, tail, error]);

  return (
    <div
      ref={log}
      role="log"
      aria-label="Conversation with the assistant"
      aria-busy={busy}
      className="scrollbar-soft flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 [--scrollbar-surface:var(--color-card)]"
    >
      {messages.length === 0 && (
        <p className="text-muted font-serif text-[16px] leading-relaxed">
          {intro}
        </p>
      )}
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {busy && last?.role !== "assistant" && (
        <p className="text-faint font-sans text-[13px]">Thinking…</p>
      )}
      {error && (
        <p className="border-warn text-warn rounded-lg border-l-4 bg-white px-3.5 py-2.5 font-sans text-[15px] leading-snug">
          {error.error}
        </p>
      )}
    </div>
  );
}
