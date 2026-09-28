"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "@/components/icons";
import { AI_MAX_TEXT_CHARS } from "@/lib/ai-chat-contract";
import { AttachButton, AttachmentTray } from "./attachment-tray";
import { pastedFiles, type useAttachments } from "./use-attachments";
import type { SendResult } from "./use-assistant-chat";

// The author's side of the chat (#309): a box that grows with what is typed,
// Enter to send and Shift+Enter for a new line, and one 44px button that sends
// or, while a reply is on its way, stops it. Photos attach by the paperclip
// beside Send or a paste (#343; the panel takes drops) and show as
// thumbnails above the text; Send waits for their uploads. Nothing is ever
// cut silently: near the route's limit a count shows, and past it Send is off
// until the text is shortened. A long message asks first (#312): while the
// question is up the text waits, read-only, and the tray is locked. While the
// box is empty the assistant's suggested next message (#366) shows ghosted in
// it, and Tab takes it into the box; any other Tab moves on as usual.

/** The count shows from here, so a long paste is never a surprise. */
const COUNT_FROM = AI_MAX_TEXT_CHARS - 2_000;
const chars = (n: number) => n.toLocaleString("en-NZ");
/** Shift+Tab, or Tab with a modifier, always does what it would anyway. */
const modifiedTab = (e: {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}) => e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
export function AssistantComposer({
  inputRef,
  busy,
  disabled,
  attachments,
  onSend,
  holding,
  putRef,
  suggestion,
  onStop,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  busy: boolean;
  /** Nothing can be sent (the month's budget is spent, the conversation is full). */
  disabled: boolean;
  attachments: ReturnType<typeof useAttachments>;
  /** Sends, or holds it for the cost question; `taken` runs once the chat
   *  has it. A refused message stays in the box. */
  onSend: (text: string, taken: () => void) => Promise<SendResult>;
  /** The cost question is up: the text waits, unchanged, and the tray is locked. */
  holding: boolean;
  /** Set here: puts a message handed back by Cancel into the box. */
  putRef: RefObject<((text: string) => void) | null>;
  /** The assistant's suggested next message, offered while the box is empty. */
  suggestion: string | null;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const attachButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`;
  }, [value, inputRef]);

  const over = value.length > AI_MAX_TEXT_CHARS;
  // Tab takes the suggestion only into an empty box that can take it.
  const ghost = value === "" && !disabled && !holding ? suggestion : null;
  const described = [
    ghost ? "assistant-input-suggestion" : null,
    value.length > COUNT_FROM ? "assistant-input-count" : null,
  ].filter(Boolean);
  // Photos can go on their own; one still uploading, or refused, holds Send.
  const canSend =
    !busy &&
    !disabled &&
    !holding &&
    !over &&
    !attachments.uploading &&
    !attachments.failed &&
    (value.trim() !== "" || attachments.ids.length > 0);
  // Cancel hands a held message back (an Ask box's, or this box's after the
  // panel was closed and opened); one already here isn't doubled.
  useEffect(() => {
    putRef.current = (text) =>
      setValue((now) =>
        now === text ? now : now.trim() ? `${now}\n\n${text}` : text,
      );
  });
  const submit = () => {
    if (!canSend) return;
    const sent = value;
    // Cleared only once taken (now, or on Continue after the cost question),
    // and only if nothing new was typed meanwhile.
    void onSend(sent, () => setValue((now) => (now === sent ? "" : now)));
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
      <AttachmentTray
        attachments={attachments}
        attachButton={attachButton}
        locked={holding}
      />
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
        placeholder={
          disabled
            ? ""
            : ghost
              ? `${ghost} (Tab to use)`
              : "Ask about this issue…"
        }
        aria-keyshortcuts="Enter"
        aria-invalid={over || undefined}
        aria-describedby={described.join(" ") || undefined}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const files = pastedFiles(e.clipboardData);
          if (!files.length) return;
          e.preventDefault();
          if (!holding) attachments.add(files);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Tab" && ghost && !modifiedTab(e)) {
            e.preventDefault();
            const el = e.currentTarget;
            setValue(ghost);
            // The caret at the end, ready to add to it or send.
            requestAnimationFrame(() =>
              el.setSelectionRange(ghost.length, ghost.length),
            );
            return;
          }
          if (e.key !== "Enter" || e.shiftKey) return;
          e.preventDefault();
          submit();
        }}
        className={`${ghost ? "placeholder:text-muted placeholder:italic" : "placeholder:text-faint"} text-ink scrollbar-soft max-h-60 min-h-[3.5rem] w-full resize-none rounded-t-xl bg-transparent px-3.5 pt-3 pb-1 font-sans text-[16px] leading-snug [--scrollbar-surface:white] disabled:cursor-not-allowed`}
      />
      {ghost && (
        <p id="assistant-input-suggestion" className="sr-only">
          Suggested: {ghost.replace(/[.!?]$/, "")}. Press Tab to use it.
        </p>
      )}
      <div className="flex items-center gap-2 px-2 pb-2">
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
        <AttachButton
          attachments={attachments}
          disabled={disabled || holding}
          buttonRef={attachButton}
        />
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
