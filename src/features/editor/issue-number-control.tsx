"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { ISSUE_NUMBER_MAX } from "@/lib/issue-number";
import type { SetIssueDisplayNumberActionResult } from "@/app/admin/actions";

type NumberStatus = "idle" | "saving" | "error";

const errorMessage = (
  reason: Exclude<SetIssueDisplayNumberActionResult, { ok: true }>["reason"],
) =>
  ({
    invalid: "Use whole numbers only.",
    duplicate: "That displayed issue number is already in use.",
    missing: "This issue no longer exists. Reload the editor.",
    error: "Couldn’t change the displayed issue number. Please try again.",
  })[reason];

export function IssueNumberControl({
  displayNumber,
  published,
  onSetDisplayNumber,
}: {
  displayNumber: number;
  published: boolean;
  onSetDisplayNumber: (
    number: number,
  ) => Promise<SetIssueDisplayNumberActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(displayNumber));
  const [status, setStatus] = useState<NumberStatus>("idle");
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.select();
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const show = () => {
    setValue(String(displayNumber));
    setStatus("idle");
    setMessage("");
    setOpen(true);
  };

  const close = (returnFocus = false) => {
    setOpen(false);
    setValue(String(displayNumber));
    setStatus("idle");
    setMessage("");
    if (returnFocus) triggerRef.current?.focus();
  };

  const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
  const valid =
    Number.isInteger(parsed) && parsed > 0 && parsed <= ISSUE_NUMBER_MAX;
  const changed = valid && parsed !== displayNumber;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setStatus("error");
      setMessage(errorMessage("invalid"));
      return;
    }
    if (!changed) return;

    setStatus("saving");
    setMessage("");
    try {
      const result = await onSetDisplayNumber(parsed);
      if (result.ok) {
        setAnnouncement(
          `Displayed issue number changed to ${result.displayNumber}.`,
        );
        setOpen(false);
        setStatus("idle");
      } else {
        setStatus("error");
        setMessage(errorMessage(result.reason));
      }
    } catch (err) {
      console.error("Changing displayed issue number failed", err);
      setStatus("error");
      setMessage(errorMessage("error"));
    }
  };

  const onPopoverKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Edit display number, currently ${displayNumber}`}
        title={`${published ? "Published" : "Draft"} issue — edit display number`}
        onClick={() => (open ? close() : show())}
        className="border-hair-warm text-faint hover:border-accent hover:bg-accent-wash hover:text-ink flex h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 font-sans text-[11px] font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color] motion-safe:active:scale-[0.97]"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            published ? "bg-accent" : "bg-chip-dot"
          }`}
        />
        No. {displayNumber}
        <Icon name="pencil" size={12} strokeWidth={1.7} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Edit issue display number"
          onKeyDown={onPopoverKeyDown}
          className="border-hair absolute top-full left-0 z-40 mt-2 w-72 rounded-xl border bg-white p-4 shadow-[0_10px_32px_rgba(40,36,28,0.2)]"
        >
          <form onSubmit={submit}>
            <label
              htmlFor="issue-number"
              className="text-ink block font-sans text-[12px] font-semibold"
            >
              Display number
            </label>
            <div className="boxed-field border-hair focus-within:border-accent mt-3 flex h-10 items-center rounded-lg border bg-white px-3">
              <span className="text-faint mr-1.5 font-sans text-xs">No.</span>
              <input
                ref={inputRef}
                id="issue-number"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setStatus("idle");
                  setMessage("");
                }}
                aria-invalid={status === "error" || undefined}
                aria-describedby={message ? "issue-number-status" : undefined}
                className="text-ink min-w-0 flex-1 bg-transparent font-sans text-sm font-semibold outline-none"
              />
            </div>

            {message && (
              <p
                id="issue-number-status"
                role="alert"
                className="text-warn mt-2 font-sans text-[11px] leading-snug"
              >
                {message}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => close(true)}
                className="h-9 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                busy={status === "saving"}
                disabled={value === String(displayNumber)}
                className="h-9 px-3 text-xs"
              >
                {status === "saving" ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
