"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/icons";
import { AI_ERROR_COPY, AI_MAX_TEXT_CHARS } from "@/lib/ai-chat-contract";
import type { SendResult } from "./use-assistant-chat";
import { BarPopover } from "../bar-popover";
import { BarRule } from "../bar-rule";

// The per-block Ask (#311): the last control in the selected block's own tool
// bar, opening a one-line box under the bar's right end (the shared
// `BarPopover`: Escape closes it and hands focus back to Ask). Sending posts to
// the panel's conversation with the block targeted — an ordinary run — and the
// panel opens to show it. A long request goes to the panel's cost question
// (#312): the box closes and the panel holds the words.

/** Room left in the route's limit for the block id and page around the words. */
const ASK_LIMIT = AI_MAX_TEXT_CHARS - 200;
type Refusal = Exclude<
  Extract<SendResult, { ok: false }>["reason"],
  "confirming"
>;
/** Why nothing was sent; the words stay in the box. */
const REFUSED: Record<Refusal, string> = {
  invalid: "Type what you'd like the assistant to do.",
  busy: "The assistant is still on the last request. Try again when it's done.",
  full: "This conversation is full. Start a new one in the panel, then send again.",
  spent: AI_ERROR_COPY.budget_spent,
  failed: "That didn't send. Try again.",
  waiting:
    "The assistant panel is asking about a long message. Answer it there, then send again.",
};

/** The box's example request, suited to what is selected. */
export const ASK_EXAMPLE = "Make this a bulleted list";

export function AskControl({
  onSend,
  compact = false,
  divider = true,
  placeholder = ASK_EXAMPLE,
}: {
  /** Icon only (with its name as a tooltip), where the bar is tight. */
  compact?: boolean;
  /** A rule between the bar's own controls and Ask. */
  divider?: boolean;
  /** An example request for this kind of block, ghosted in the empty box. */
  placeholder?: string;
  /** Says whether the conversation took it (not when full, spent, busy). */
  onSend: (text: string) => Promise<SendResult>;
}) {
  const [value, setValue] = useState("");
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [sending, setSending] = useState(false);
  const noteId = useId();

  const over = value.length > ASK_LIMIT;
  const submit = async (close: (refocus?: boolean) => void) => {
    if (!value.trim() || over || sending) return;
    setSending(true);
    const result = await onSend(value);
    setSending(false);
    // Held for the panel's question: the words are the panel's now.
    if (!result.ok && result.reason !== "confirming")
      return setRefused(result.reason);
    setValue("");
    close(false);
  };

  return (
    <>
      {divider && <BarRule />}
      <BarPopover
        name="ask"
        label="Ask the assistant about this block"
        onClose={() => setRefused(null)}
        trigger={({ open, toggle, boxId, triggerRef }) => (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={open ? boxId : undefined}
            aria-haspopup="dialog"
            aria-label="Ask"
            title="Ask the assistant about this block"
            onClick={toggle}
            className={`border-hair text-ink hover:border-accent flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] border bg-white font-sans text-[12px] font-semibold ${compact ? "w-7 justify-center" : "px-2.5"} ${open ? "border-accent" : ""}`}
          >
            <Icon name="sparkle" size={15} className="text-accent" />
            {!compact && "Ask"}
          </button>
        )}
      >
        {({ close }) => (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(close);
              }}
              className="flex items-stretch gap-1.5"
            >
              <input
                type="text"
                value={value}
                aria-label="What should the assistant do with this block?"
                aria-invalid={over || undefined}
                aria-describedby={over || refused ? noteId : undefined}
                placeholder={placeholder}
                onChange={(e) => {
                  setValue(e.target.value);
                  setRefused(null);
                }}
                // The same size as the bar's own fields (the photo bar's Alt).
                className="boxed-field border-hair text-ink placeholder:text-faint min-w-0 flex-1 rounded-[6px] border bg-white px-2 py-1 font-sans text-[12px]"
              />
              <button
                type="submit"
                aria-label="Send"
                title="Send (Enter)"
                disabled={!value.trim() || over || sending}
                // As tall as the field; the press area reaches a little past it.
                className="bg-accent text-paper enabled:hover:bg-accent-strong relative flex w-8 flex-none cursor-pointer items-center justify-center rounded-[6px] transition-colors after:absolute after:-inset-y-1.5 after:-right-1.5 after:left-0 after:content-[''] disabled:cursor-default disabled:opacity-45"
              >
                <Icon name="send" size={14} strokeWidth={2.2} />
              </button>
            </form>
            {(over || refused) && (
              <p
                id={noteId}
                role="alert"
                className="text-warn px-1 pt-1.5 font-sans text-[12px] leading-snug font-semibold"
              >
                {over
                  ? "Too long for the Ask box. Use the assistant panel for long requests."
                  : refused && REFUSED[refused]}
              </p>
            )}
          </>
        )}
      </BarPopover>
    </>
  );
}
