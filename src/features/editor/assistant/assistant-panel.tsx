"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { AI_ERROR_COPY } from "@/lib/ai-chat-contract";
import { usageLine, type AiUsageSummary } from "@/lib/ai-usage-summary";
import { AssistantComposer } from "./assistant-composer";
import { AssistantThread } from "./assistant-thread";
import { Icon } from "@/components/icons";
import type { EditorSnapshot } from "../use-editor-history";
import type { RunSummary } from "./executor";
import {
  PRESETS,
  presetMessage,
  type PresetId,
  type PresetTarget,
} from "./presets";
import type { useAssistantChat } from "./use-assistant-chat";

const DRAFTS_ONLY =
  "The assistant only works on drafts. Start a new issue to use it.";
const INTRO =
  "Ask it to tidy a page, turn a list into bullets, rewrite or shorten text, place photos or compose the cover, or ask what’s on a page. Everything it does can be undone in one step.";

// The assistant's side panel (#309): every state it can be in. A published
// issue gets one message and no composer; a spent budget keeps the thread but
// disables the composer; a full conversation offers a fresh one. On opening,
// focus goes to the composer (or the message standing in for it).
export function AssistantPanel({
  chat,
  published,
  cover,
  usage,
  target,
  historyTop,
  onUndo,
}: {
  chat: ReturnType<typeof useAssistantChat>;
  published: boolean;
  /** On a cover the inspector steps aside while the panel is out. */
  cover: boolean;
  usage: AiUsageSummary | null;
  /** The page open now and its selected block, for the presets. */
  target: PresetTarget;
  /** The step Ctrl+Z would restore: a run's line stands while it's the run's. */
  historyTop: EditorSnapshot | null;
  onUndo: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const spent = budgetSpent(chat, usage);
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
            reviewing={chat.reviewing}
            error={
              // Told in the panel's own words: the spent month below, the run
              // cap as the circuit-breaker's message.
              chat.error?.code === "budget_spent" ||
              chat.error?.code === "run_cap"
                ? null
                : chat.error
            }
            intro={INTRO}
            after={
              <RunResult
                // Anything else recorded since means the run is no longer one
                // Undo away: its line goes.
                summary={
                  chat.summary?.step === historyTop ? chat.summary : null
                }
                stuck={chat.stuck}
                onUndo={onUndo}
              />
            }
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
            <Presets
              disabled={chat.busy || spent || chat.full}
              cover={cover}
              onPick={(id) => void chat.send(presetMessage(id, target))}
            />
            <AssistantComposer
              inputRef={input}
              busy={chat.busy}
              disabled={spent || chat.full}
              onSend={chat.send}
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

/** The month's budget is spent: nothing more can be sent. */
export const budgetSpent = (
  chat: Pick<ReturnType<typeof useAssistantChat>, "error">,
  usage: AiUsageSummary | null,
) =>
  chat.error?.code === "budget_spent" ||
  (usage !== null && usage.remaining <= 0);

// The quick requests (#310): one tap sends a fixed message for the page open
// now (see presets.ts). A cover gets its own (#313).
function Presets({
  disabled,
  cover,
  onPick,
}: {
  disabled: boolean;
  cover: boolean;
  onPick: (id: PresetId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.filter((preset) => preset.cover === cover).map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onPick(preset.id);
          }}
          className={`border-hair-warm text-ink h-9 rounded-full border bg-white px-3 font-sans text-[13px] font-semibold ${disabled ? "cursor-default opacity-45" : "hover:border-accent hover:text-accent-strong"}`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

// What the last run did, with its one-step Undo while that is still the step
// Ctrl+Z would take; or, when the circuit-breaker stopped it, why.
function RunResult({
  summary,
  stuck,
  onUndo,
}: {
  summary: RunSummary | null;
  stuck: string | null;
  onUndo: () => void;
}) {
  if (!summary && !stuck) return null;
  return (
    <div
      data-assistant-run
      className="border-line flex flex-col gap-2.5 rounded-lg border bg-white px-3.5 py-3 font-sans text-[15px] leading-snug"
    >
      {stuck && <p className="text-warn font-medium">{stuck}</p>}
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-ink">{summary.text}</p>
          <button
            type="button"
            onClick={onUndo}
            className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash inline-flex h-11 flex-none cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-white px-4 font-sans text-[15px] font-semibold transition-colors motion-safe:active:scale-95"
          >
            <Icon name="undo" size={17} />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
