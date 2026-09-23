"use client";

import { forwardRef } from "react";
import { MEMBER_NAME_MAX } from "@/lib/member-name";

// A posting-name text box: a real <label>, the focus ring on the box rather
// than the bare input (.boxed-field), and the refusal tied to it for readers.
export const NameField = forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    value: string;
    error: string | null;
    disabled?: boolean;
    visuallyHiddenLabel?: boolean;
    onChange: (value: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    /** Controls set beside the box (Add, Save…), matched to its height. */
    children?: React.ReactNode;
  }
>(function NameField(
  {
    id,
    label,
    value,
    error,
    disabled = false,
    visuallyHiddenLabel = false,
    onChange,
    onKeyDown,
    children,
  },
  ref,
) {
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0 flex-1">
      <label
        htmlFor={id}
        className={
          visuallyHiddenLabel
            ? "sr-only"
            : "text-ink mb-2 block font-sans text-[15px] font-semibold"
        }
      >
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`boxed-field flex h-11 min-w-[12rem] flex-1 items-center rounded-lg border-[1.5px] bg-white px-3.5 ${
            error ? "border-warn" : "border-line"
          } ${disabled ? "opacity-60" : ""}`}
        >
          <input
            ref={ref}
            id={id}
            type="text"
            autoComplete="off"
            // Room past the limit, so the rule's own message explains it.
            maxLength={MEMBER_NAME_MAX + 20}
            value={value}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="text-ink h-full min-w-0 flex-1 border-none bg-transparent font-sans text-[16px]"
          />
        </div>
        {/* The controls wrap together, never one away from the other. */}
        {children && <div className="flex gap-2">{children}</div>}
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-warn mt-2 font-sans text-[14px] leading-snug"
        >
          {error}
        </p>
      )}
    </div>
  );
});
