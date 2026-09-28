"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui";
import { AI_ERROR_COPY } from "@/lib/ai-chat-contract";
import { usageLine, type AiUsageSummary } from "@/lib/ai-usage-summary";
import { AssistantComposer } from "./assistant-composer";
import { AssistantHints } from "./assistant-hints";
import { AssistantThread } from "./assistant-thread";
import { FollowUpButton } from "./follow-up-button";
import type { HintContext } from "./hints";
import { PasteConfirm } from "./paste-confirm";
import type { EditorSnapshot } from "../use-editor-history";
import { presetMessage, type PresetTarget } from "./presets";
import { RunResult } from "./run-result";
import type { useAssistantChat } from "./use-assistant-chat";
import { filesOf, type useAttachments } from "./use-attachments";
import type { ConfirmedSend } from "./use-confirmed-send";

const DRAFTS_ONLY =
  "The assistant only works on drafts. Start a new issue to use it.";
const INTRO =
  "Ask it to tidy a page, turn a list into bullets, rewrite or shorten text, place photos or compose the cover, or ask what’s on a page. Everything it does can be undone in one step.";
const PHOTOS_NOTE =
  "You can attach photos here, or drop them on this panel. They’re added to this issue’s photos, and the assistant’s provider sees them so it can place them and describe them.";

// The assistant's side panel (#309): every state it can be in. A published
// issue gets one message and no composer; a spent budget keeps the thread but
// disables the composer; a full conversation offers a fresh one. On opening,
// focus goes to the composer (or the message standing in for it). Photos
// dropped anywhere on the panel attach to the next message (#343). Everything
// sends through `gate`, which holds a long message for the cost question (#312).
export function AssistantPanel({
  chat,
  gate,
  attachments,
  unplaced,
  published,
  cover,
  usage,
  target,
  context,
  historyTop,
  focusKey = 0,
  onUndo,
  onRestart,
}: {
  chat: ReturnType<typeof useAssistantChat>;
  gate: ConfirmedSend;
  attachments: ReturnType<typeof useAttachments>;
  /** Photos attached to the last run's message that no page places now. */
  unplaced: number;
  published: boolean;
  /** On a cover the inspector steps aside while the panel is out. */
  cover: boolean;
  usage: AiUsageSummary | null;
  /** The page open now and its selected block, for the presets. */
  target: PresetTarget;
  /** What the open page has, for choosing the hints (#366). */
  context: Omit<HintContext, "cover">;
  /** The step Ctrl+Z would restore: a run's line stands while it's the run's. */
  historyTop: EditorSnapshot | null;
  /** Counts the openings that take the focus (#353): the composer takes it on
   *  each change, as it does on mount. Focusing a hidden tab is a no-op. */
  focusKey?: number;
  onUndo: () => void;
  /** Starts a fresh conversation; null while there is nothing to leave (#353). */
  onRestart: (() => void) | null;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const spent = budgetSpent(chat, usage);
  const blocked = published || spent || chat.full;
  // A long message waiting on the cost question (#312): nothing else goes, and
  // the tray takes no photos in or out.
  const { pending } = gate;
  // The presets and the suggested follow-up (#366) wait while anything would
  // refuse them; each is an ordinary send with no photos.
  const quiet = chat.busy || spent || chat.full || pending !== null;
  const sendFixed = (text: string) => void gate.ask({ text, attachments: [] });
  const composerPut = useRef<((text: string) => void) | null>(null);
  const handBack = () => {
    const back = gate.cancel();
    if (back) composerPut.current?.(back.text);
    input.current?.focus();
  };
  const [dropping, setDropping] = useState(false);
  const dragging = (e: DragEvent) => {
    if (blocked || pending || !e.dataTransfer.types.includes("Files"))
      return false;
    e.preventDefault();
    return true;
  };
  useEffect(() => {
    if (blocked) notice.current?.focus();
    // A question up as the panel opens has taken the focus itself.
    else if (!gate.pending) input.current?.focus();
    // Only on opening: the panel's content mounts as it slides in, or its tab
    // is opened again while it is already mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);
  // A fresh conversation hands the focus back to the composer.
  const wasFull = useRef(chat.full);
  useEffect(() => {
    if (wasFull.current && !chat.full) input.current?.focus();
    wasFull.current = chat.full;
  }, [chat.full]);

  return (
    <div
      data-assistant-panel
      className={`relative flex min-h-0 flex-1 flex-col ${dropping ? "bg-accent-wash" : ""}`}
      onDragOver={(e) => {
        if (dragging(e)) setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (dragging(e)) attachments.add(filesOf(e.dataTransfer));
      }}
    >
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
            intro={`${INTRO}\n\n${PHOTOS_NOTE}`}
            after={
              <>
                <RunResult
                  // Anything else recorded since means the run is no longer
                  // one Undo away: its line goes.
                  summary={
                    chat.summary?.step === historyTop ? chat.summary : null
                  }
                  stuck={chat.stuck}
                  unplaced={unplaced}
                  onUndo={onUndo}
                />
                {chat.followUp && (
                  <FollowUpButton
                    followUp={chat.followUp}
                    disabled={quiet}
                    onSend={() => sendFixed(chat.followUp!.message)}
                  />
                )}
              </>
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
                    <Button
                      size="compact"
                      onClick={() => {
                        // A paste still asking goes back to the box, editable.
                        handBack();
                        chat.restart();
                      }}
                    >
                      Start a new one
                    </Button>
                  </>
                )}
              </div>
            )}
            <AssistantHints
              context={{ ...context, cover }}
              page={target.page}
              busy={chat.busy}
              disabled={quiet}
              onPick={(id) => sendFixed(presetMessage(id, target))}
            />
            {pending && (
              <PasteConfirm
                chars={pending.text.length}
                model={usage?.model ?? null}
                // A run under way, a full conversation or a photo not ready
                // would refuse the send: the question and the text wait instead.
                blocked={continueHeld(chat, pending, attachments)}
                onContinue={async () => {
                  if (continueHeld(chat, pending, attachments)) return;
                  // The message and its photos go once the chat takes them:
                  // only then do the box and the tray clear.
                  if ((await gate.confirm()).ok) input.current?.focus();
                }}
                onCancel={handBack}
              />
            )}
            <AssistantComposer
              inputRef={input}
              busy={chat.busy}
              disabled={spent || chat.full}
              attachments={attachments}
              holding={pending !== null}
              putRef={composerPut}
              suggestion={chat.followUp?.message ?? null}
              onRestart={onRestart}
              onSend={(text, taken) => {
                // The ids as they were on sending; the tray empties only once
                // the message is taken, now or on Continue.
                const ids = attachments.ids;
                return gate.ask({ text, attachments: ids }, () => {
                  taken();
                  attachments.clear(ids);
                });
              }}
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

/** Continue waits while the chat can't take the message, or its photos aren't
 *  all uploaded. */
const continueHeld = (
  chat: Pick<ReturnType<typeof useAssistantChat>, "busy" | "full">,
  pending: { attachments: string[] },
  attachments: Pick<ReturnType<typeof useAttachments>, "uploading" | "failed">,
) =>
  chat.busy ||
  chat.full ||
  (pending.attachments.length > 0 &&
    (attachments.uploading || attachments.failed));

/** The month's budget is spent: nothing more can be sent. */
export const budgetSpent = (
  chat: Pick<ReturnType<typeof useAssistantChat>, "error">,
  usage: AiUsageSummary | null,
) =>
  chat.error?.code === "budget_spent" ||
  (usage !== null && usage.remaining <= 0);
