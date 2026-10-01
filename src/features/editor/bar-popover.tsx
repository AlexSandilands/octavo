"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useBarFit } from "./use-bar-fit";

// The small box a block bar's button opens under the bar's right end (Ask, Alt):
// a non-modal dialog that takes focus into its first field, keeps Tab inside,
// closes on a press anywhere else, and on Escape hands focus back to its
// button without the block deselecting. It slides to stay inside the canvas.

export type BarPopoverTrigger = {
  open: boolean;
  toggle: () => void;
  /** The box's id, for the button's aria-controls. */
  boxId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const STOPS =
  "input:not(:disabled),textarea:not(:disabled),button:not(:disabled)";

export function BarPopover({
  name,
  label,
  className = "w-[20rem]",
  onClose,
  trigger,
  children,
}: {
  /** Which control this is; `ask` keeps its `data-ask` hook. */
  name: "ask" | "alt";
  /** The dialog's accessible name. */
  label: string;
  /** The box's width. */
  className?: string;
  /** Whenever the box closes, however it got there. */
  onClose?: () => void;
  trigger: (api: BarPopoverTrigger) => ReactNode;
  /** `close(false)` leaves focus where it is (a send that unmounts the field). */
  children: (api: { close: (refocus?: boolean) => void }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Kept inside the canvas like the bar: on a wrapped bar it may sit far left.
  const box = useBarFit<HTMLDivElement>();
  const boxId = useId();

  useEffect(() => {
    if (open)
      box.current
        ?.querySelector<HTMLElement>("input:not(:disabled),textarea")
        ?.focus();
  }, [open, box]);
  // Like the pickers: a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose]);

  // Focus goes back to the button once the box has gone.
  const [back, setBack] = useState(0);
  useEffect(() => {
    if (back) triggerRef.current?.focus();
  }, [back]);
  const close = (refocus = true) => {
    setOpen(false);
    onClose?.();
    if (refocus) setBack((n) => n + 1);
  };
  // A small dialog keeps the focus: Tab cycles its own controls.
  const trap = (e: KeyboardEvent) => {
    const stops = Array.from(
      box.current?.querySelectorAll<HTMLElement>(STOPS) ?? [],
    );
    const at = stops.findIndex((el) => el === document.activeElement);
    e.preventDefault();
    stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
  };

  return (
    <div
      ref={root}
      data-bar-popover={name}
      data-ask={name === "ask" ? "" : undefined}
      className="relative flex flex-none"
      onClick={(e) => e.stopPropagation()}
    >
      {trigger({
        open,
        toggle: () => (open ? close() : setOpen(true)),
        boxId,
        triggerRef,
      })}
      {open && (
        <div
          ref={box}
          id={boxId}
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Tab") return trap(e);
            if (e.key !== "Escape") return;
            // The stage's Escape would deselect the block too.
            e.stopPropagation();
            close();
          }}
          className={`border-hair absolute top-full right-0 z-40 mt-3 rounded-[8px] border bg-white p-1.5 whitespace-normal shadow-[0_8px_24px_rgba(40,36,28,0.18)] ${className}`}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
