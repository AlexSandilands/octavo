"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { AI_ERROR_COPY, AI_MAX_TEXT_CHARS } from "@/lib/ai-chat-contract";
import type { SendResult } from "./use-assistant-chat";

// The per-block Ask (#311): the last control in the selected block's own tool
// bar, opening a one-line box under the bar's right end. Sending posts to the
// panel's conversation with the block targeted — an ordinary run — and the
// panel opens to show it. Escape closes the box and hands focus back to Ask.

/** Room left in the route's limit for the block id and page around the words. */
const ASK_LIMIT = AI_MAX_TEXT_CHARS - 200;
type Refusal = Extract<SendResult, { ok: false }>["reason"];
/** Why nothing was sent; the words stay in the box. */
const REFUSED: Record<Refusal, string> = {
  invalid: "Type what you'd like the assistant to do.",
  busy: "The assistant is still on the last request. Try again when it's done.",
  full: "This conversation is full. Start a new one in the panel, then send again.",
  spent: AI_ERROR_COPY.budget_spent,
  failed: "That didn't send. Try again.",
};

export function AskControl({
  onSend,
  compact = false,
  divider = true,
}: {
  /** Icon only (with its name as a tooltip), where the bar is tight. */
  compact?: boolean;
  /** A rule between the bar's own controls and Ask. */
  divider?: boolean;
  /** Says whether the conversation took it (not when full, spent, busy). */
  onSend: (text: string) => Promise<SendResult>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [sending, setSending] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const send = useRef<HTMLButtonElement>(null);
  const boxId = useId();

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  // Like the pickers: a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setRefused(null);
    trigger.current?.focus();
  };
  const over = value.length > ASK_LIMIT;
  const submit = async () => {
    if (!value.trim() || over || sending) return;
    setSending(true);
    const result = await onSend(value);
    setSending(false);
    if (!result.ok) return setRefused(result.reason);
    setValue("");
    setRefused(null);
    setOpen(false);
  };
  // A small dialog keeps the focus: Tab cycles the box and Send.
  const trap = (e: KeyboardEvent) => {
    const stops = [input.current, send.current].filter(
      (el) => el && !el.disabled,
    ) as HTMLElement[];
    const at = stops.findIndex((el) => el === document.activeElement);
    e.preventDefault();
    stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
  };

  return (
    <>
      {divider && <span className="bg-line h-5 w-px flex-none" />}
      <div
        ref={root}
        data-ask
        className="relative flex flex-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={open ? boxId : undefined}
          aria-haspopup="dialog"
          aria-label="Ask"
          title="Ask the assistant about this block"
          onClick={() => (open ? close() : setOpen(true))}
          className={`border-hair text-ink hover:border-accent flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] border bg-white font-sans text-[12px] font-semibold ${compact ? "w-7 justify-center" : "px-2.5"} ${open ? "border-accent" : ""}`}
        >
          <Icon name="sparkle" size={15} className="text-accent" />
          {!compact && "Ask"}
        </button>
        {open && (
          <div
            id={boxId}
            role="dialog"
            aria-label="Ask the assistant about this block"
            onKeyDown={(e) => {
              if (e.key === "Tab") return trap(e);
              if (e.key !== "Escape") return;
              // The stage's Escape would deselect the block too.
              e.stopPropagation();
              close();
            }}
            className="border-hair absolute top-full right-0 z-40 mt-3 w-[22rem] rounded-lg border bg-white p-2 whitespace-normal shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={input}
                type="text"
                value={value}
                aria-label="What should the assistant do with this block?"
                aria-invalid={over || undefined}
                aria-describedby={over || refused ? `${boxId}-note` : undefined}
                placeholder="Make this a bulleted list"
                onChange={(e) => {
                  setValue(e.target.value);
                  setRefused(null);
                }}
                className="boxed-field border-line text-ink placeholder:text-faint h-11 min-w-0 flex-1 rounded-lg border-[1.5px] bg-white px-3 font-sans text-[16px]"
              />
              <button
                ref={send}
                type="submit"
                aria-label="Send"
                title="Send (Enter)"
                disabled={!value.trim() || over || sending}
                className="bg-accent text-paper enabled:hover:bg-accent-strong flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-45"
              >
                <Icon name="send" size={18} strokeWidth={2} />
              </button>
            </form>
            {(over || refused) && (
              <p
                id={`${boxId}-note`}
                role="alert"
                className="text-warn px-1 pt-2 font-sans text-[13px] leading-snug font-semibold"
              >
                {over
                  ? "Too long for the Ask box. Use the assistant panel for long requests."
                  : refused && REFUSED[refused]}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
