"use client";

import { useEffect, useState, type RefObject } from "react";
import { Icon } from "@/components/icons";
import { AI_MAX_TEXT_CHARS } from "@/lib/ai-chat-contract";
import { needsCostConfirm } from "./paste-estimate";

// The author's side of the chat (#309): a box that grows with what is typed,
// Enter to send and Shift+Enter for a new line, and one 44px button that sends
// or, while a reply is on its way, stops it. The row under the text keeps its
// left end free for the attach button and thumbnails #343 adds. Nothing is ever
// cut silently: near the route's limit a count shows, and past it Send is off
// until the text is shortened. A long message asks first (#312): it goes to
// `onLongPaste` instead, and the text stays, read-only, until it is sent.

/** The count shows from here, so a long paste is never a surprise. */
const COUNT_FROM = AI_MAX_TEXT_CHARS - 2_000;
const chars = (n: number) => n.toLocaleString("en-NZ");
export function AssistantComposer({
  inputRef,
  busy,
  disabled,
  onSend,
  onLongPaste,
  holding,
  onStop,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  busy: boolean;
  /** Nothing can be sent (the month's budget is spent, the conversation is full). */
  disabled: boolean;
  onSend: (text: string) => void;
  /** A message long enough to ask first; `clear` empties the box once it's sent. */
  onLongPaste: (text: string, clear: () => void) => void;
  /** That question is up: the text waits, unchanged. */
  holding: boolean;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`;
  }, [value, inputRef]);

  const over = value.length > AI_MAX_TEXT_CHARS;
  const canSend =
    !busy && !disabled && !holding && !over && value.trim() !== "";
  const submit = () => {
    if (!canSend) return;
    // What goes out: #343 adds its text attachments to this.
    const size = value.length;
    if (needsCostConfirm(size)) {
      onLongPaste(value, () => setValue(""));
      return;
    }
    onSend(value);
    setValue("");
    // Send turns into Stop under a pointer; the box keeps the focus.
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={`boxed-field border-line flex flex-col rounded-xl border-[1.5px] bg-white ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <label htmlFor="assistant-input" className="sr-only">
        Message the assistant
      </label>
      <textarea
        ref={inputRef}
        id="assistant-input"
        rows={2}
        value={value}
        disabled={disabled}
        readOnly={holding}
        placeholder={disabled ? "" : "Ask about this issue…"}
        aria-keyshortcuts="Enter"
        aria-invalid={over || undefined}
        aria-describedby={
          value.length > COUNT_FROM ? "assistant-input-count" : undefined
        }
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing)
            return;
          e.preventDefault();
          submit();
        }}
        className="text-ink placeholder:text-faint scrollbar-soft max-h-60 min-h-[3.5rem] w-full resize-none rounded-t-xl bg-transparent px-3.5 pt-3 pb-1 font-sans text-[16px] leading-snug [--scrollbar-surface:white] disabled:cursor-not-allowed"
      />
      <div className="flex items-center gap-2 px-2 pb-2">
        {/* #343's attach button and thumbnails go here. */}
        <div className="min-w-0 flex-1">
          {value.length > COUNT_FROM && (
            <p
              id="assistant-input-count"
              role={over ? "alert" : undefined}
              className={`px-1.5 font-sans text-[13px] leading-snug ${
                over ? "text-warn font-semibold" : "text-faint"
              }`}
            >
              {over
                ? `${chars(value.length - AI_MAX_TEXT_CHARS)} characters over the ${chars(AI_MAX_TEXT_CHARS)} limit. Shorten it, or send it in parts.`
                : `${chars(value.length)} of ${chars(AI_MAX_TEXT_CHARS)} characters`}
            </p>
          )}
        </div>
        {busy ? (
          <button
            type="button"
            onClick={() => {
              onStop();
              inputRef.current?.focus();
            }}
            aria-label="Stop the reply"
            title="Stop"
            className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border-[1.5px] bg-white transition-colors motion-safe:active:scale-95"
          >
            <Icon name="stop" size={18} />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            title="Send (Enter)"
            disabled={!canSend}
            className="bg-accent text-paper enabled:hover:bg-accent-strong flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-45 motion-safe:enabled:active:scale-95"
          >
            <Icon name="send" size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </form>
  );
}
