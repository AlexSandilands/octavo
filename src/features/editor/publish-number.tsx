"use client";

import { useId, type RefObject } from "react";
import { ISSUE_NUMBER_MAX } from "@/lib/issue-number";

// The publish modal's issue-number row (issue #270). A draft has no number
// until now, so this proposes the next one in the published sequence and lets
// the admin type another — for a back issue being digitised, say. Once the
// issue is live the number is read-only: renumbering would break every link
// already shared or emailed.
export function PublishNumber({
  value,
  onChange,
  disabled,
  error,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  /** A refusal to show under the field, from this modal or the server. */
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="border-hair mt-5 rounded-lg border-[1.5px] bg-white p-4">
      <label
        htmlFor={id}
        className="text-ink flex items-center gap-3 font-sans text-[14px] font-semibold"
      >
        Publish as No.
        <input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={ISSUE_NUMBER_MAX}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          aria-invalid={error !== null}
          className={`text-ink h-11 w-28 rounded-lg border-[1.5px] bg-white px-3 font-sans text-[15px] tabular-nums outline-none disabled:opacity-60 ${
            error === null ? "border-hair focus:border-accent" : "border-warn"
          }`}
        />
      </label>
      <p
        id={hintId}
        aria-live="polite"
        className={`mt-2 font-sans text-[12px] leading-relaxed ${
          error === null ? "text-faint2" : "text-warn font-semibold"
        }`}
      >
        {error ??
          "The next number in the sequence. Change it if this is a back issue — once published, the number is fixed."}
      </p>
    </div>
  );
}

// The same row for an issue that is already live: what its number is, and why
// it can't be changed.
export function PublishedNumber({ number }: { number: number }) {
  return (
    <div className="border-hair mt-5 rounded-lg border-[1.5px] bg-white p-4">
      <div className="text-ink font-sans text-[14px] font-semibold">
        Published as No. {number}
      </div>
      <p className="text-faint2 mt-2 font-sans text-[12px] leading-relaxed">
        An issue keeps its number for good, so links already shared and emailed
        go on working.
      </p>
    </div>
  );
}
