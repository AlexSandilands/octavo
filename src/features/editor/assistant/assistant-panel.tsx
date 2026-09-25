"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { AI_ERROR_COPY } from "@/lib/ai-chat-contract";
import { usageLine, type AiUsageSummary } from "@/lib/ai-usage-summary";
import { AssistantComposer } from "./assistant-composer";
import { AssistantThread } from "./assistant-thread";
import type { useAssistantChat } from "./use-assistant-chat";

const DRAFTS_ONLY =
  "The assistant only works on drafts. Unpublish or create a new issue to use it.";
const INTRO =
  "Ask about this issue: what’s on a page, or which pages are nearly full. It reads the issue but can’t change it yet.";
const PRESETS = [
  "Tidy this page",
  "Make bullets",
  "Rewrite for clarity",
  "Shorten to fit",
];

// The assistant's side panel (#309): every state it can be in. A published
// issue gets one message and no composer; a spent budget keeps the thread but
// disables the composer; a full conversation offers a fresh one. On opening,
// focus goes to the composer (or the message standing in for it).
export function AssistantPanel({
  chat,
  published,
  cover,
  usage,
}: {
  chat: ReturnType<typeof useAssistantChat>;
  published: boolean;
  /** On a cover the inspector steps aside while the panel is out. */
  cover: boolean;
  usage: AiUsageSummary | null;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const spent =
    chat.error?.code === "budget_spent" ||
    (usage !== null && usage.remaining <= 0);
  const blocked = published || spent || chat.full;
  useEffect(() => {
    if (blocked) notice.current?.focus();
    else input.current?.focus();
    // Only on opening: the panel's content mounts as it slides in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A fresh conversation hands the focus back to the composer.
  const wasFull = useRef(chat.full);
  useEffect(() => {
    if (wasFull.current && !chat.full) input.current?.focus();
    wasFull.current = chat.full;
  }, [chat.full]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="sr-only">Assistant</h2>
      {cover && !published && (
        <p className="border-line bg-paper text-muted border-b px-5 py-2.5 font-sans text-[13px] leading-snug">
          The cover inspector is hidden while the assistant is open.
        </p>
      )}
      {published ? (
        <div
          ref={notice}
          tabIndex={-1}
          className="text-ink flex flex-1 items-center justify-center px-8 text-center font-serif text-[17px] leading-relaxed outline-none"
        >
          {DRAFTS_ONLY}
        </div>
      ) : (
        <>
          <AssistantThread
            messages={chat.messages}
            busy={chat.busy}
            error={chat.error?.code === "budget_spent" ? null : chat.error}
            intro={INTRO}
          />
          <div className="border-line flex flex-col gap-3 border-t px-4 pt-3 pb-3">
            {(spent || chat.full) && (
              <div
                ref={notice}
                tabIndex={-1}
                role="status"
                className="text-ink flex flex-col items-start gap-2.5 font-sans text-[15px] leading-snug outline-none"
              >
                {spent ? (
                  AI_ERROR_COPY.budget_spent
                ) : (
                  <>
                    <p>This conversation is full.</p>
                    <Button size="compact" onClick={chat.restart}>
                      Start a new one
                    </Button>
                  </>
                )}
              </div>
            )}
            <Presets />
            <AssistantComposer
              inputRef={input}
              busy={chat.busy}
              disabled={spent || chat.full}
              onSend={(text) => void chat.send(text)}
              onStop={chat.stop}
            />
            {usage && (
              <p className="text-faint flex items-baseline justify-between gap-3 px-1 font-sans text-[13px]">
                <span data-assistant-usage>{usageLine(usage)}</span>
                <a
                  href="/admin/ai"
                  className="text-accent hover:text-accent-strong font-medium hover:underline"
                >
                  Usage
                </a>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// The quick requests #310 wires up, shown now so the layout has their room.
function Presets() {
  return (
    <div className="group relative flex flex-wrap gap-1.5">
      {PRESETS.map((label) => (
        <button
          key={label}
          type="button"
          aria-disabled
          aria-describedby="assistant-presets-soon"
          className="border-hair-warm text-ink h-9 cursor-default rounded-full border bg-white px-3 font-sans text-[13px] font-semibold opacity-45"
        >
          {label}
        </button>
      ))}
      <span
        id="assistant-presets-soon"
        role="tooltip"
        className="bg-ink text-paper pointer-events-none absolute bottom-full left-0 z-50 mb-2 rounded-md px-3 py-2 font-sans text-xs font-medium opacity-0 shadow-md transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        Editing arrives soon
      </span>
    </div>
  );
}
