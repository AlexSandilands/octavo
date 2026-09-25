"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Icon } from "@/components/icons";
import { AI_ERROR_COPY, AI_MAX_TEXT_CHARS } from "@/lib/ai-chat-contract";
import type { SendResult } from "./use-assistant-chat";

// The per-block Ask (#311): a pill at the selected block's top-right corner
// opening a one-line box. Sending posts to the panel's conversation with the
// block targeted — an ordinary run — and the panel opens to show it. Escape
// closes the box and hands focus back to the pill.

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
/** Space between the pill and the block's own tool bar, in screen px. */
const GAP = 8;

export function AskControl({
  onSend,
}: {
  /** Says whether the conversation took it (not when full, spent, busy). */
  onSend: (text: string) => Promise<SendResult>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [sending, setSending] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const send = useRef<HTMLButtonElement>(null);
  const boxId = useId();
  const lift = useClearOfBar(root, pill);

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
    pill.current?.focus();
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
    <div
      ref={root}
      data-ask
      className="chrome-unscaled absolute right-0 bottom-full z-30"
      style={{ transformOrigin: "bottom right", marginBottom: 8 + lift }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={pill}
        type="button"
        aria-expanded={open}
        aria-controls={open ? boxId : undefined}
        aria-haspopup="dialog"
        title="Ask the assistant about this block"
        onClick={() => (open ? close() : setOpen(true))}
        className={`border-hair text-ink hover:border-accent hover:text-accent-strong flex h-11 cursor-pointer items-center gap-1.5 rounded-[8px] border bg-white px-3 font-sans text-[13px] font-semibold shadow-[0_4px_14px_rgba(40,36,28,0.16)] ${open ? "border-accent" : ""}`}
      >
        <Icon name="sparkle" size={15} />
        Ask
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
          className="border-hair absolute top-full right-0 mt-2 w-[22rem] rounded-lg border bg-white p-2 shadow-[0_8px_24px_rgba(40,36,28,0.18)]"
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
  );
}

/**
 * How far to lift the pill (page px) so it clears the block's own tool bar,
 * which starts at the block's left edge: nothing while they fit side by side,
 * otherwise the pill stands above the bar. Both keep a fixed screen size while
 * the page zooms, so this is measured on every render as well as on resize.
 */
function useClearOfBar(
  root: RefObject<HTMLDivElement | null>,
  pill: RefObject<HTMLButtonElement | null>,
) {
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const block = root.current?.closest<HTMLElement>("[data-editor-block]");
    if (!block || !pill.current) return;
    const measure = () => {
      const bar = block.querySelector("[data-block-bar]");
      const own = pill.current?.getBoundingClientRect();
      if (!bar || !own) return setLift(0);
      const edge = bar.getBoundingClientRect();
      const scale = block.getBoundingClientRect().width / block.offsetWidth;
      setLift(
        edge.right + GAP > own.left ? (edge.height + GAP) / (scale || 1) : 0,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(block);
    return () => observer.disconnect();
  });
  return lift;
}
